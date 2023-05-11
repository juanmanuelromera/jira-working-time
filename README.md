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

You have to create a configuration file
```json
{
    "jqlQuery": "",
    "workingStatus": "",
    "maxResults": ""
}
```

##### JQL Query
In the `jqlQuery` you have to introduce a JQL Query about the issues that you are interested to get the working times.

Example:
```js
"project IN (OPX) AND issuetype in (Story, Task, Sub-task, Bug) AND resolution = Done AND resolutiondate >= 2022-01-01 AND  resolutiondate <= 2022-12-31 ORDER BY resolutiondate DESC"
```

##### Working Status
In the `workingStatus` you could define which are the status that you consider as working status in your Jira Workflow.

Example:
```js
["Study", "In Progress", "In Review", "Production check (DoD)"]
```

##### Max Result
In the `maxResult` you have to define a number of max results for you query.

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
    npm start [creadentials-file.json] [configuration-file.json]
    ```   

To replace the arguments, input the path of the credentials and configuration file. Alternatively, you can leave the arguments blank and the script will automatically use the credentials.json and configuration.json files in the current folder.

The result is going to be saved in a output.csv file.

## Authors
Juan Manuel Romera Ferrio

## License
This project is licensed under the MIT License - see the LICENSE.md file for details