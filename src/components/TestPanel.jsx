import React, { useState, useEffect } from 'react';
import '../main.css';
import { Accordion, useAccordionButton, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
    fetchTestList,
    triggerTest,
    triggerAllTests,
    monitorJenkinsBuild
} from '../../helpers/app/testPanelHelpers';

const TestPanel = () => {
    const [error, setError] = useState(false);
    const [success, setSuccess] = useState(false);
    const [testStatus, setTestStatus] = useState({});
    const [loading, setLoading] = useState({});
    const [testResults, setTestResults] = useState([]);
    const [testList, setTestList] = useState([]);
    const navigate = useNavigate();
    const [allTestsLoading, setAllTestsLoading] = useState(false);
    const [allTestsSuccess, setAllTestsSuccess] = useState(null); // true = success, false = failure, null = default
    const [inProgressData, setInProgressData] = useState({});


    const getOngoingTestsFromStorage = () => {
        const data = localStorage.getItem('ongoingTests');
        return data ? JSON.parse(data) : {};
    };
    const [isInitialLoad, setIsInitialLoad] = useState(true); // İlk açılış kontrolü

    useEffect(() => {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        if (!isAuthenticated) {
            navigate('/');
        }
    }, [navigate]);

    useEffect(() => {
        fetchTestList(setTestList);
    }, []);

    useEffect(() => {
        const ongoingTests = getOngoingTestsFromStorage();

        Object.keys(ongoingTests).forEach(async testId => {
            const { jobUrl, status } = ongoingTests[testId];
            setTestStatus(prev => ({ ...prev, [testId]: status }));

            if (status === 'loading' || status === 'running') {
                await monitorJenkinsBuild(jobUrl, setTestStatus, testId, setError, setSuccess);
            }
        });
    }, []);



    const handleSignOut = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/');
    };
    const closeSuccess = () => {
        setSuccess(false);
        setLoading({});
        setTestStatus({});
    };

    const closeError = () => {
        setError(false);
        setLoading({});
        setTestStatus({});
    };

    const cleanError = (errorMessage) => {
        return errorMessage
            .replace(/Slow test file:[\s\S]+Consider splitting slow test files[\s\S]+/g, '')
            .replace(/\)\s*\)/g, '')
            .replace(/\d+\s*\|\s*[\s\S]+/g, '')
            .replace(/^\s*\d+\)\s*\[chromium\]\s*›/gm, '')
            .replace(/─+/g, '')
            .trim();
    };
    const cleanSuccess = (successMessage) => {
        return successMessage
            .replace(/Slow test file:[\s\S]+Consider splitting slow test files[\s\S]+/g, '')
            .replace(/\d+ passed \(\d+\.\ds\)/g, '')
            .trim();
    };

    const [lastRuns, setLastRuns] = useState({});

    useEffect(() => {
        const fetchLastRuns = async () => {
            try {
                const response = await fetch('http://localhost:3000/lastRuns');
                const data = await response.json();

                if (data.success) {
                    setLastRuns(data.lastRuns);
                }
            } catch (error) {
                console.error("Error fetching last runs:", error);
            }
        };

        fetchLastRuns();
    }, []);

    useEffect(() => {
        const fetchInProgressBuilds = async () => {
            try {
                const res = await fetch("http://localhost:3000/inProgressBuilds");
                const data = await res.json();

                if (data.success) {
                    setInProgressData(data.inProgressBuilds);

                    // inProgress olan testleri "running" durumu ile işaretle
                    Object.values(data.inProgressBuilds).forEach(({ testName, jobUrl }) => {
                        setTestStatus(prev => ({ ...prev, [testName]: 'running' }));

                        // Testi düzenli olarak kontrol et
                        monitorJenkinsBuild(jobUrl, setTestStatus, testName, setError, setSuccess);
                    });
                }
            } catch (err) {
                console.error("In-progress fetch error:", err);
            }
        };

        // İlk sayfa yüklenince çağır
        fetchInProgressBuilds();

        // Her 5 saniyede bir kontrol et
        const intervalId = setInterval(() => {
            fetchInProgressBuilds();
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const checkBuildStatuses = async () => {
            for (const buildInfo of Object.values(inProgressData)) {
                const { testName, jobUrl } = buildInfo;

                try {
                    const response = await fetch('http://localhost:3000/checkJenkinsStatus', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobUrl }),
                    });

                    const { result, building, logs } = await response.json();

                    if (!building) {
                        if (result === 'SUCCESS') {
                            setTestStatus(prev => ({ ...prev, [testName]: 'success' }));
                            setSuccess(logs);
                        } else {
                            setTestStatus(prev => ({ ...prev, [testName]: 'failure' }));
                            setError(logs);
                        }

                        // inProgressData'dan bu testi çıkar
                        setInProgressData(prev => {
                            const newData = { ...prev };
                            delete newData[testName];
                            return newData;
                        });
                    }
                } catch (err) {
                    console.error("Error polling build status:", err);
                }
            }
        };

        if (Object.keys(inProgressData).length > 0) {
            checkBuildStatuses();
        }
    }, [inProgressData]);




    return (
        <div className="h-screen flex flex-col p-4">
            <header className="flex justify-between p-4">
                <div className="flex gap-2">
                    <button className="bg-custom-purple px-4 py-2 text-white rounded">Home</button>
                    <button className="bg-custom-purple px-4 py-2 text-white rounded">Test</button>
                    <button
                        onClick={() => triggerAllTests(setAllTestsLoading, setAllTestsSuccess)}
                        className={`bg-custom-purple px-4 py-2 text-white rounded 
        ${allTestsLoading ? 'bg-yellow-500 cursor-not-allowed' :
                            allTestsSuccess === null ? 'bg-custom-purple' :
                                allTestsSuccess ? 'bg-green-500' : 'bg-red-500'}`}
                        disabled={allTestsLoading}
                    >
                        {allTestsLoading ? 'Loading...' : allTestsSuccess === null ? 'Run All Tests' : allTestsSuccess ? 'SUCCESS' : 'FAILURE'}
                    </button>
                </div>
                <button onClick={handleSignOut} className="bg-custom-purple px-4 py-2 text-white rounded">Sign Out
                </button>
            </header>
            <main className="flex-1 flex">
                <div className="w-2/4 p-2">
                    {testList.map((test, index) => (
                        <Accordion className="mb-2 "  key={test.id} defaultActiveKey="0">
                            <Card className="border-1 " style={{borderRadius: 24}}>
                                <button
                                    className={`
        p-1 absolute top-1 px-2 rounded-3xl right-2 focus:outline-none
        ${
                                        testStatus[test.name] === 'loading'
                                            ? 'bg-yellow-500 cursor-not-allowed'
                                            : testStatus[test.name] === 'running'
                                                ? 'bg-blue-500 text-white cursor-not-allowed'
                                                : testStatus[test.name] === 'success'
                                                    ? 'bg-green-500 text-white'
                                                    : testStatus[test.name] === 'failure'
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-gray-200 hover:bg-gray-300'
                                    }
    `}
                                    onClick={() => triggerTest(test.path, test.name, setError, setSuccess, setTestStatus)}
                                    disabled={
                                        testStatus[test.name] === 'loading' ||
                                        testStatus[test.name] === 'running'
                                    }
                                >
                                    {testStatus[test.name] === 'loading'
                                        ? 'Loading...'
                                        : testStatus[test.name] === 'running'
                                            ? 'Running...'
                                            : testStatus[test.name] === 'success'
                                                ? 'SUCCESS'
                                                : testStatus[test.name] === 'failure'
                                                    ? 'FAILURE'
                                                    : 'RUN TEST'
                                    }
                                </button>


                                <Card.Header className="flex w-full rounded-3xl">
                                    <ContextAwareToggle eventKey="1">{`${index + 1}. ${test.name}`}</ContextAwareToggle>
                                </Card.Header>
                                <Accordion.Collapse eventKey="1">
                                    <Card.Body>
                                        <Accordion>
                                            <Card className="border-1 mb-2">
                                                <Card.Header>
                                                    <ContextAwareToggle eventKey="2">Description</ContextAwareToggle>
                                                </Card.Header>
                                                <Accordion.Collapse eventKey="2">
                                                    <Card.Body className="border">
                                                        <p className="overflow-auto pb-3 whitespace-nowrap">{test.description || 'No description available'}</p>
                                                    </Card.Body>
                                                </Accordion.Collapse>
                                            </Card>
                                            <Card className="border-1 mb-2">
                                                <Card.Header>
                                                    <ContextAwareToggle eventKey="3">Test Steps</ContextAwareToggle>
                                                </Card.Header>
                                                <Accordion.Collapse eventKey="3">
                                                    <Card.Body className="border">
                                                        <div className="overflow-auto max-h-56 pb-3 whitespace-nowrap">
                                                            <ul>
                                                                {test["test steps"] && test["test steps"].length > 0 ? (
                                                                    test["test steps"].map((step, stepIndex) => (
                                                                        <li key={stepIndex}>{step}</li>
                                                                    ))
                                                                ) : (
                                                                    <li>No test steps available</li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    </Card.Body>
                                                </Accordion.Collapse>
                                            </Card>
                                            <Card className="border-1">
                                                <Card.Header>
                                                    <ContextAwareToggle eventKey="4">Last Run Status and
                                                        Details</ContextAwareToggle>
                                                </Card.Header>
                                                <Accordion.Collapse eventKey="4">
                                                    <Card.Body className="border">
                                                        {lastRuns[test.name] ? (
                                                            <div>
                                                                <p><strong>Test
                                                                    Name:</strong> {lastRuns[test.name].testName}</p>
                                                                <p>
                                                                    <strong>Test Result
                                                                        :</strong> {lastRuns[test.name].result === 'SUCCESS' ? '✅ Successful' : '❌ Failed'}
                                                                </p>
                                                                <p>
                                                                    <strong>Date of the Test
                                                                        :</strong> {new Date(lastRuns[test.name].timestamp).toLocaleDateString()}
                                                                </p>
                                                                <p>
                                                                    <strong>Time of the Test
                                                                        :</strong> {new Date(lastRuns[test.name].timestamp).toLocaleTimeString()}
                                                                </p>
                                                                <p>
                                                                    <strong>Test Duration
                                                                        :</strong> {(lastRuns[test.name].duration / 1000).toFixed(2)} seconds
                                                                </p>
                                                                <a href={`${lastRuns[test.name].url}`}
                                                                   target="_blank" rel="noopener noreferrer"
                                                                   className="text-blue-500">
                                                                    View Details
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <p>No recent test runs for this test.</p>
                                                        )}
                                                    </Card.Body>
                                                </Accordion.Collapse>
                                            </Card>
                                        </Accordion>
                                    </Card.Body>
                                </Accordion.Collapse>
                            </Card>
                        </Accordion>
                    ))}
                </div>

                {error && (
                    <div
                        className="flex flex-col justify-between w-2/4 bg-white h-[550px] rounded-lg border mt-2 overflow-auto">
                        <div className="pb-2 border-b mx-4">
            <pre className="bg-red-500 text-white ml-2 mt-2 px-2 py-1 rounded cursor-default">
                Error Test : {cleanError(error)}
            </pre>

                            {error.includes('https://test-panel-stroge.s3.eu-central-1.amazonaws.com/Error') && (
                                <div className="mt-2">
                                    <p className="text-red-500">Error Image:</p>
                                    <img
                                        src={error.match(/https:\/\/test-panel-stroge\.s3\.eu-central-1\.amazonaws\.com\/Error\/[^\n]+/)[0]}
                                        alt="Error Screenshot"
                                        className="border mt-2"
                                        style={{maxHeight: '500px', maxWidth: '100%'}}
                                    />
                                </div>
                            )}

                        </div>
                        <button onClick={closeError} className="w-2/4 mb-2 bg-red-500 text-white self-center px-4 py-2 rounded">
                            Close
                        </button>
                    </div>
                )}

                {success && (
                    <div className="flex flex-col justify-between w-2/4 bg-white h-96 rounded-lg border mt-2 overflow-auto">
                        <div className="pb-2 border-b mx-4">
            <pre className="bg-green-500 text-white ml-2 mt-2 px-2 py-1 rounded cursor-default">
                Success Test : {cleanSuccess(success)}
            </pre>

                            {success && success.includes('https://test-panel-stroge.s3.eu-central-1.amazonaws.com/Success') && (
                                <div className="mt-2">
                                    <p className="text-green-500">Success Image :</p>
                                    <img
                                        src={success.match(/https:\/\/test-panel-stroge\.s3\.eu-central-1\.amazonaws\.com\/Success\/[^\n]+/)[0]}
                                        alt="Success Screenshot"
                                        className="border mt-2"
                                        style={{ maxHeight: '500px', maxWidth: '100%' }}
                                    />
                                </div>
                            )}
                        </div>
                        <button onClick={closeSuccess}
                                className="w-2/4 mb-2 bg-green-500 text-white self-center px-4 py-2 rounded">
                            Close
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
};

function ContextAwareToggle({children, eventKey}) {
    const decoratedOnClick = useAccordionButton(eventKey);

    return (
        <button
            type="button"
            className="w-full text-left focus:outline-none"
            onClick={decoratedOnClick}
        >
            {children}
        </button>
    );
}

export default TestPanel;
