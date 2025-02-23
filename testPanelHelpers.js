export const fetchTestList = async (setTestList) => {
    try {
        const response = await fetch('http://localhost:3000/gettestlist');
        const list = await response.json();
        setTestList(list);
    } catch (error) {
        console.error('Error retrieving test list :', error);
        setTestList([]);
    }
};



function getOngoingTestsFromStorage() {
    const data = localStorage.getItem('ongoingTests');
    return data ? JSON.parse(data) : {};
}

function saveOngoingTestsToStorage(ongoingTests) {
    localStorage.setItem('ongoingTests', JSON.stringify(ongoingTests));
}

export function removeTestFromStorage(testId) {
    const ongoingTests = getOngoingTestsFromStorage();
    delete ongoingTests[testId];
    saveOngoingTestsToStorage(ongoingTests);
}

function updateTestStatusInStorage(testId, newStatus) {
    const ongoingTests = getOngoingTestsFromStorage();
    if (ongoingTests[testId]) {
        ongoingTests[testId].status = newStatus;
        saveOngoingTestsToStorage(ongoingTests);
    }
}

export function setTestInStorage(testId, jobUrl) {
    const ongoingTests = getOngoingTestsFromStorage();
    ongoingTests[testId] = { jobUrl, status: 'loading' };
    saveOngoingTestsToStorage(ongoingTests);
}


export const triggerTest = async (
    testPath,
    testId,
    setError,
    setSuccess,
    setTestStatus
) => {
    try {
        setTestStatus(prev => ({ ...prev, [testId]: 'loading' }));

        const response = await fetch('http://localhost:3000/runTest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testPath }),
        });

        if (!response.ok) {
            throw new Error('Test API failed to trigger');
        }

        const { jobUrl } = await response.json();

        setTestInStorage(testId, jobUrl);

        // **İlk API çağrısı tamamlandıktan sonra başlat**
        setTimeout(() => {
            monitorJenkinsBuild(jobUrl, setTestStatus, testId, setError, setSuccess);
        }, 2000);

    } catch (error) {
        console.error('An error occurred while triggering the test:', error.message);
        setTestStatus(prev => ({ ...prev, [testId]: 'failure' }));
        setError(error.message);
    }
};



// testPanelHelpers.js
// testPanelHelpers.js

// 1) removeTestFromStorage fonksiyonunu import ettiğinizden emin olun
// import { removeTestFromStorage } from '...';

const monitoredTests = new Set(); // Çalışan testleri takip etmek için bir Set oluştur

export const monitorJenkinsBuild = async (
    jobUrl,
    setTestStatus,
    testId,
    setError,
    setSuccess
) => {
    if (monitoredTests.has(testId)) return; // Eğer test zaten izleniyorsa tekrar çağırma

    monitoredTests.add(testId);
    setTestStatus(prev => ({ ...prev, [testId]: 'running' }));
    updateTestStatusInStorage(testId, 'running');

    const checkStatus = async () => {
        try {
            const buildStatus = await fetch('http://localhost:3000/checkJenkinsStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobUrl }),
            });

            const { result, building, logs } = await buildStatus.json();

            if (!building) {
                monitoredTests.delete(testId); // Takip listesinden çıkar
                if (result === 'SUCCESS') {
                    setTestStatus(prev => ({ ...prev, [testId]: 'success' }));
                    setSuccess(logs);
                    updateTestStatusInStorage(testId, 'success');
                } else {
                    setTestStatus(prev => ({ ...prev, [testId]: 'failure' }));
                    setError(logs);
                    updateTestStatusInStorage(testId, 'failure');
                }
                removeTestFromStorage(testId);
                return;
            }

            setTimeout(checkStatus, 6000); // 6 saniye sonra tekrar dene
        } catch (err) {
            console.error("Polling sırasında hata oluştu:", err);
        }
    };

    checkStatus(); // İlk çağrıyı başlat
};



export const triggerAllTests = async (
    setAllTestsLoading,
    setAllTestsSuccess
) => {
    try {
        setAllTestsLoading(true);
        setAllTestsSuccess(null);

        const response = await fetch('http://localhost:3000/runAllTests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('All tests failed to trigger API');
        }

        const { allResults } = await response.json();

        const allSuccessful = allResults.every(result => result.result);
        setAllTestsSuccess(allSuccessful);

    } catch (error) {
        console.error('Error occurred while running all tests:', error.message);
        setAllTestsSuccess(false);
    } finally {
        setAllTestsLoading(false);
    }
};
