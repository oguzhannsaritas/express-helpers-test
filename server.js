const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');
const app = express();
const port = 3000;
const resultFilePath = path.join(__dirname, 'testResults.json');
const yamlFilePath = path.join(__dirname, 'testList.yaml');
const { sendEmail, triggerJenkinsBuild, checkJenkinsBuildStatus , } =require ( './utilities/jenkinsUtils');
const JENKINS_USERNAME = process.env.JENKINS_USERNAME || 'YOUR NAME';
const JENKINS_TOKEN = process.env.JENKINS_TOKEN || 'YOUR TOKEN';



app.use(cors({
    origin: 'http://localhost:3006',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));


app.options('*', cors());


app.use(express.json());

async function getTestListFromYaml() {
    try {
        const yamlContent = await fs.readFile(yamlFilePath, 'utf8');
        const yamlData = yaml.load(yamlContent);
        return yamlData.tests || [];
    } catch (error) {
        console.error("Error reading YAML file:", error);
        return [];
    }
}

app.get('/gettestlist', async (req, res) => {
    try {
        const testList = await getTestListFromYaml();
        res.json(testList);
    } catch (error) {
        console.error("Error while retrieving test names:", error);
        res.status(500).json({ success: false, error: 'Test names could not be retrieved' });
    }
});

async function saveTestResult(testName, result) {
    try {
        let results = [];

        try {
            const data = await fs.readFile(resultFilePath, 'utf-8');
            if (data) {
                results = JSON.parse(data);
            }
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                console.log('testResults.json not found, a new file will be created.');
            } else {
                console.error("Error reading file :", readError);
                throw readError;
            }
        }

        const isSuccess = !result.includes("FAIL");
        const newResult = {
            testName,
            result: isSuccess,
            date: new Date().toISOString(),
            error: !isSuccess ? result : null
        };
        results.push(newResult);

        await fs.writeFile(resultFilePath, JSON.stringify(results, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error saving test result:", error);
    }
}








app.post('/runTest', async (req, res) => {
    const { testPath } = req.body;

    if (!testPath) {
        return res.status(400).json({ success: false, message: 'Test path not provided.' });
    }

    try {
        const testList = await getTestListFromYaml();
        const matchedTest = testList.find(t => t.path === testPath);

        const testName = matchedTest ? matchedTest.name : 'Unknown Test';

        console.log(`🔹 [runTest] Running test: ${testPath} - name: ${testName}`);


        const jobUrl = await triggerJenkinsBuild(testPath, testName);

        if (!jobUrl) {
            console.error(`❌ [runTest] Jenkins job could not be triggered for ${testPath}`);
            return res.status(500).json({
                success: false,
                message: `Failed to trigger Jenkins job for ${testPath}. Check Jenkins logs.`
            });
        }

        console.log(`✅ [runTest] Jenkins job triggered successfully: ${jobUrl}`);

        res.json({ success: true, jobUrl });

    } catch (error) {
        console.error(`🔥 [runTest] Error occurred: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error in runTest',
            error: error.message,
            stack: error.stack
        });
    }
});


app.post('/runAllTests', async (req, res) => {
    try {
        const testList = await getTestListFromYaml();

        if (testList.length === 0) {
            return res.status(400).json({ success: false, message: 'Test list is empty' });
        }

        let allResults = [];

        for (const test of testList) {
            const { path, name } = test;
            try {
                const jobUrl = await triggerJenkinsBuild(path, name);
                if (jobUrl) {
                    const result = await runTestAndMonitor(jobUrl, name);
                    allResults.push({ testName: name, result });
                } else {
                    allResults.push({ testName: name, result: false });
                }
            } catch (error) {
                allResults.push({ testName: name, result: false });
                console.error(`${name} çalıştırılırken hata:`, error.message);
                await sendEmail(`${name} Test Error`, error.message);
            }
        }

        res.json({ success: true, allResults });
    } catch (error) {
        console.error("Tüm testler çalıştırılırken hata oluştu:", error);
        res.status(500).json({ success: false, error: 'Failed to run all tests' });
    }
});

async function runTestAndMonitor(jobUrl, testName) {
    let resultData, logs;
    let isBuilding = true;

    while (isBuilding) {
        const buildStatus = await fetch('http://localhost:3000/checkJenkinsStatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobUrl })
        });

        const { result, building, logs: buildLogs } = await buildStatus.json();
        isBuilding = building;
        logs = buildLogs;

        if (!isBuilding) {
            resultData = result;
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 6000));
    }

    if (resultData === 'SUCCESS') {
        await sendEmail(`${testName} Successfully Completed`, logs);
        return true;
    } else {
        const errorMatch = logs.match(/1\) \[chromium\][\s\S]*?Error:.*?\n\s+at[\s\S]*?\.js:\d+:\d+/);
        if (errorMatch) {
            logs = errorMatch[0].trim();
        } else {
            logs = 'No relevant error message found.';
        }
        await sendEmail(`${testName} Failed`, logs);
        return false;
    }
}



app.post('/checkJenkinsStatus', async (req, res) => {
    const { jobUrl } = req.body;

    try {
        const buildStatus = await checkJenkinsBuildStatus(jobUrl);
        res.json(buildStatus);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/lastRuns', async (req, res) => {
    try {
        const response = await axios.get('http://jenkins:8080/job/playwrightTest/api/json', {
            auth: { username: JENKINS_USERNAME, password: JENKINS_TOKEN }
        });

        const builds = response.data.builds;
        if (!builds || builds.length === 0) {
            return res.json({ success: false, message: 'No builds found' });
        }

        let lastRuns = {};

        for (const build of builds) {
            const buildUrl = `http://jenkins:8080/job/playwrightTest/${build.number}/api/json`;
            const buildResponse = await axios.get(buildUrl, {
                auth: { username: JENKINS_USERNAME, password: JENKINS_TOKEN }
            });

            const buildData = buildResponse.data;

                     // inProgress = true ise henüz bitmemiş demektir, lastRuns'a dahil etmiyoruz
                        if (buildData.inProgress) {
                              continue;
                         }

            const testName = buildData.displayName;

            // Zaten testName yoksa ya da daha eski bir build ise güncelle
            if (!lastRuns[testName] || buildData.timestamp > lastRuns[testName].timestamp) {
                lastRuns[testName] = {
                    testName,
                    result: buildData.result,
                    timestamp: buildData.timestamp,
                    duration: buildData.duration,
                    url: `${buildData.url}artifact/playwright-test-output.log/*view*/`
                };
            }
        }

        res.json({ success: true, lastRuns });

    } catch (error) {
        console.error("Error fetching last run details:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/inProgressBuilds', async (req, res) => {
    try {
        const response = await axios.get('http://jenkins:8080/job/playwrightTest/api/json', {
            auth: { username: JENKINS_USERNAME, password: JENKINS_TOKEN }
        });

        const builds = response.data.builds;
        if (!builds || builds.length === 0) {
            return res.json({ success: true, inProgressBuilds: {} });
        }

        let inProgressBuilds = {};

        for (const build of builds) {
            const buildUrl = `http://jenkins:8080/job/playwrightTest/${build.number}/api/json`;
            const buildResponse = await axios.get(buildUrl, {
                auth: { username: JENKINS_USERNAME, password: JENKINS_TOKEN }
            });

            const buildData = buildResponse.data;

            if (buildData.inProgress) {
                const testName = buildData.displayName; // Yaml'daki "name" ile eşleştiğini varsayıyoruz
                inProgressBuilds[testName] = {
                    testName,
                    inProgress: buildData.inProgress,
                    buildNumber: buildData.number,
                    jobUrl: buildUrl,  // Jenkins'teki API JSON URL
                    timestamp: buildData.timestamp
                };
            }
        }

        res.json({ success: true, inProgressBuilds });
    } catch (error) {
        console.error("Error fetching in-progress builds:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});





app.listen(port, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${port}`);
});
