const axios = require('axios');
const process = require('process');
const fs = require('fs');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Retrieving the parameters
const credentialsFile = process.argv[2] || 'credentials.json'
const configurationFile = process.argv[3] || 'configuration.json'

// Define work range
const workHoursStart = 9;
const workHoursEnd = 18;
const holidays = [
    '2022-01-01',
    '2022-01-06',
    '2022-04-14',
    '2022-04-15',
    '2022-05-02',
    '2022-05-16',
    '2022-07-25',
    '2022-08-15',
    '2022-10-12',
    '2022-11-01',
    '2022-11-09',
    '2022-12-06',
    '2022-12-08',
    '2022-12-26'
];
const workingDays = [1, 2, 3, 4, 5];
let parents = new Map();
const NO_EPIC = 'No Epic';

//Jira Credentials
const jiraCredentials = fs.readFileSync(credentialsFile);
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
const configuration = fs.readFileSync(configurationFile);
const { jqlQuery, workingStatus, maxResults } = JSON.parse(configuration);

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
        let epicSummary = issue.fields?.parent?.fields?.summary ?? NO_EPIC;
        let parentKey = issue.fields?.parent?.key ?? '';

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
                            parentKey: parentKey,
                            epic: epicSummary,
                            startdate: stateStartDate,
                            enddate: stateEndDate,
                            resolutiondate: resolutiondate,
                            status: currentState,
                            assignee,
                            time: timeInState,
                        });
                        currentState = item.fromString;
                        assignee = history.author.displayName;
                        stateEndDate = new Date(history.created);

                        if (epicSummary !== NO_EPIC) {
                            parents.set(issueKey, epicSummary);
                        }

                    }
                }
            }
        }
        return statusTime.filter((item) =>
            workingStatus.includes(item.status));
    } catch (error) {
        console.log(error);
        return [];
    }
}

// Calculate Working Hours
function getDiffTimeInWorkingHours(startDate, endDate) {
    // Store minutes worked
    var minutesWorked = 0;

    // Validate input
    if (endDate < startDate) { return 0; }

    // Loop from your Start to End dates (by hour)
    var current = new Date(startDate);

    // Loop while currentDate is less than end Date (by minutes)
    while (current <= endDate) {
        // Is the current time within a work day (and if it 
        // occurs on a weekend or not)          
        if (workingDays.includes(current.getDay()) && current.getHours() >= workHoursStart && current.getHours() < workHoursEnd) {
            if (!holidays.includes(moment(current).format('YYYY-MM-DD'))) {
                minutesWorked++;
                // Increment current time
                current.setTime(current.getTime() + 1000 * 60);
            } else {
                current.setDate(current.getDate() + 1);
                current.setHours(workHoursStart, 0, 0, 0);
            }
        } else {
            // Increment current time
            current.setTime(current.getTime() + 1000 * 60);
        }
    }
    // Return the number of hours
    return minutesWorked / 60;
}

function groupAndSum(data) {
    const result = Object.values(data.reduce((acc, curr) => {
        if (!acc[curr.assignee]) {
            acc[curr.assignee] = {
                key: curr.key,
                type: curr.type,
                epic: curr.epic,
                startdate: Number.POSITIVE_INFINITY,
                enddate: Number.NEGATIVE_INFINITY,
                resolutiondate: curr.resolutiondate,
                assignee: curr.assignee,
                time: 0
            };
        }
        acc[curr.assignee].time += parseFloat(curr.time);
        acc[curr.assignee].startdate = acc[curr.assignee].startdate > curr.startdate ? curr.startdate : acc[curr.assignee].startdate;
        acc[curr.assignee].enddate = acc[curr.assignee].enddate < curr.enddate ? curr.enddate : acc[curr.assignee].enddate;
        return acc;
    }, {}));
    return result;
}


// Write CSV
function writeCSV(data) {
    const flatData = data.flat();
    const finalData = flatData.map(item => {
        if (item.parentKey && parents.has(item.parentKey)) {
            item.epic = parents.get(item.parentKey);
        }
        return item;
    });
    const csvWriter = createCsvWriter({
        path: 'output.csv',
        header: [
            { id: 'key', title: 'key' },
            { id: 'type', title: 'type' },
            { id: 'epic', title: 'epic' },
            { id: 'status', title: 'status' },
            { id: 'startdate', title: 'startdate' },
            { id: 'enddate', title: 'enddate' },
            { id: 'resolutiondate', title: 'resolutiondate' },
            { id: 'assignee', title: 'assignee' },
            { id: 'time', title: 'time' }
        ]
    });

    csvWriter.writeRecords(finalData)
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
