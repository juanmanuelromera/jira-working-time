const axios = require('axios');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

//Jira Credentials
const jiraCredentials = fs.readFileSync('credentials.json');
const { username, apiToken } = JSON.parse(jiraCredentials);
const credentials = Buffer.from(`${username}:${apiToken}`).toString('base64');
const options = {
    headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json'
    }
};

// JIRA Query
const jiraUrl = 'https://feverup.atlassian.net';
const jiraApiUrl = `${jiraUrl}/rest/api/2`;
const jqlQuery = "project IN (OPX) AND issuetype in (Story, Task, Sub-task, Bug) AND resolution = Done AND resolutiondate >= 2022-01-01 AND  resolutiondate <= 2022-12-31 ORDER BY resolutiondate DESC"
const maxResults = 2000;
const workingStatus = ["Study", "In Progress", "In Review", "Production check (DoD)"]


// Get Issues From Query
async function getIssues(jqlQuery, maxResults) {
    const response = await axios.get(`${jiraApiUrl}/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=${maxResults}&fields=key`, options);
    const keys = response.data.issues.map(issue => issue.key);
    return keys;
}


// Get Working Time by Assingee from each Issue
async function getIssueStatusTime(issueKey) {
    try {
        const issueResponse = await axios.get(`${jiraApiUrl}/issue/${issueKey}?expand=changelog`, options);
        const issue = issueResponse.data;
        const histories = issue.changelog.histories;
        const statusTime = [];

        if (histories === undefined || issue.fields.assignee === undefined) {
            return [];
        }

        let currentState = issue.fields.status.name;
        let assignee = issue.fields.assignee == null ? "Unassigned" : issue.fields.assignee.displayName;
        let issuetype = issue.fields.issuetype.name;
        let resolutiondate = issue.fields.resolutiondate;
        let epicKey = issue.fields.customfield_10007 ? issue.fields.customfield_10007 : "";
        let stateEndDate = new Date();

        for (let i = 0; i < histories.length; i++) {
            const history = histories[i];
            for (let j = 0; j < history.items.length; j++) {
                const item = history.items[j];
                if (item.field === 'status') {
                    const status = item.toString;
                    if (status == currentState) {
                        const stateStartDate = new Date(history.created);
                        const timeInState = getDiffTimeInWorkingHours(stateStartDate, stateEndDate);
                        statusTime.push({
                            key: issueKey,
                            type: issuetype,
                            epic: epicKey,
                            resolutiondate: resolutiondate,
                            status: currentState,
                            assignee,
                            time: timeInState,
                        });
                        currentState = item.fromString;
                        assignee = history.author.displayName;
                        stateEndDate = new Date(history.created);

                    }
                }
            }
        }
        return groupAndSum(statusTime.filter((item) =>
            workingStatus.includes(item.status)
        ));
    } catch (error) {
        console.log(error);
        return [];
    }
}

// Calculate Working Hours
function getDiffTimeInWorkingHours(startDate, endDate) {
    const startHour = 8;
    const endHour = 20;
    const workingDays = [1, 2, 3, 4, 5];

    let diffHours = 0;
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
        const currentDay = currentDate.getDay();
        const currentHour = currentDate.getHours();

        if (workingDays.includes(currentDay) && currentHour >= startHour && currentHour < endHour) {
            diffHours++;
        }
        //add 1 hour
        currentDate.setTime(currentDate.getTime() + 60 * 60 * 1000);
    }
    return diffHours.toFixed();
}

function groupAndSum(data) {
    const result = Object.values(data.reduce((acc, curr) => {
        if (!acc[curr.assignee]) {
            acc[curr.assignee] = {
                key: curr.key,
                type: curr.type,
                epic: curr.epic,
                resolutiondate: curr.resolutiondate,
                assignee: curr.assignee,
                time: 0
            };
        }
        acc[curr.assignee].time += parseInt(curr.time);
        return acc;
    }, {}));
    return result;
}


// Write CSV
function writeCSV(data) {
    const flatData = data.flat();
    const csvWriter = createCsvWriter({
        path: 'output.csv',
        header: [
            { id: 'key', title: 'key' },
            { id: 'type', title: 'type' },
            { id: 'epic', title: 'epic' },
            { id: 'resolutiondate', title: 'resolutiondate' },
            { id: 'assignee', title: 'assignee' },
            { id: 'time', title: 'time' }
        ]
    });

    csvWriter.writeRecords(flatData)
        .then(() => console.log('Success!'))
        .catch(error => console.log('Error', error));
}


// Execute
getIssues(jqlQuery, maxResults)
    .then(results => {
        const promises = results.map(key => {
            return getIssueStatusTime(key);
        });
        return Promise.all(promises);
    }).then(response => {
        writeCSV(response);
    })
    .catch((error) => {
        console.error(error);
    });
