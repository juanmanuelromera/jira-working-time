# Jira Working Time
Here you can find a script that could generate a CSV with the Time by Assignees in Jira Issues.

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
You need to get a [Jira API Token](https://id.atlassian.com/manage-profile/security/api-tokens) and create a credentials.json file.

```json
{
    "username": "YOUR_USERNAME",
    "apiToken": "YOUR_API_TOKEN"
}
```

### Installing
1. Clone the Repository
    ```sh
    git clone git@github.com:juanmanuelromera/jira-working-time.git
    ```
2. Install the required packages
    ```sh
    npm install
    ```
3. Run the script
    ```sh
    npm run
    ```   

## Configuration
To configure your result you have to modify the script.js file.

### JQL Query
In the `jqlQuery` variable you have to introduce a JQL Query about the issues that you are interested to get the working times.

Example:
```js
const jqlQuery = "project IN (OPX) AND issuetype in (Story, Task, Sub-task, Bug) AND resolution = Done 
AND resolutiondate >= 2022-01-01 AND  resolutiondate <= 2022-12-31 ORDER BY resolutiondate DESC"
```

### Working States
In the `workingStatus` variable you could define which are the status that you consider as working status in your Jira Workflow.

Example:
```js
const workingStatus = ["Study", "In Progress", "In Review", "Production check (DoD)"]
```

## Authors
Juan Manuel Romera Ferrio

## License
This project is licensed under the MIT License - see the LICENSE.md file for details