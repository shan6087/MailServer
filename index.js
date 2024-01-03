const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');

//  implemented the Login with google API

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */


async function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }
  console.log('Labels:');
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

authorize().then(listLabels).catch(console.error);

// <--------------------------------------------->

  
const labelName = "Vacation-Mails";
// to get unreplied messages 

async function getUnrepliedEmails(auth){
  console.log("Getunrepliedmessages function executed");
  const gmail = google.gmail({version:"v1" ,auth })
  const response = await gmail.users.messages.list({
    userId:"me",
    labelIds:["INBOX"],
    q: '-in:chats -from:me -has:userlabels',

  })
  return response.data.messages || [];

}


// adding a label 

async function addLabel(auth, message, labelId) {
  const gmail = google.gmail({version: 'v1', auth});
  await gmail.users.messages.modify({
  userId: 'me',
  id: message.id,
  requestBody: {
  addLabelIds: [labelId],
  removeLabelIds: ['INBOX'],
  },
  }); 
}


 //  Create Label function
 async function createLabel(auth) {
  console.log('function createlabel executed ')

  const gmail = google.gmail({ version: "v1", auth });
  try {
    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    return response.data.id;
  } catch (error) {
    if (error.code === 409) {
      const response = await gmail.users.labels.list({
        userId: "me",
      });
      const label = response.data.labels.find(
        (label) => label.name === labelName
      );
      return label.id;
    } else {
      throw error;
    }
  }
}


//SendResponse function

 
async function sendResponse (auth, message) {
  console.log('function sendResponse executed  ')

  const gmail = google.gmail({version: 'v1', auth});
  const res = await gmail.users.messages.get({
  userId: 'me',
  id: message.id,
  format: 'metadata',
  metadataHeaders: ['Subject', 'From'],
  }); 
  const subject = res.data.payload.headers.find(
  (header) => header.name === 'Subject'
  ).value
  const from = res.data.payload.headers.find(
  (header) => header.name === 'From'
  ).value;
  
  const  replyTo = from.match(/<(.*)>/)[1]; //from address Email format
  const replySubject =  subject.startsWith('Re:') ? subject: `Re: ${subject}`; 
  const replyBody = `Hi, \n\n this is an autoresponse,created as a part of my learning processs i'll respond you in a while.\n\n Best regards, \n Mohamed Sahil`;
  const rawMessage = [
    `From: me`,
    `To: ${replyTo}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${message.id}`, 
    `References: ${message.id}`,
    '',
    replyBody,
    ].join('\n'); 
    const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
    raw: encodedMessage,
    },
    }); 
  }

  // adding all this functions into  the main function

  //Main function 

  async function main() {
    
    const labelId = await createLabel(auth);
    console.log(`Label has been created  ${labelId}`);
    setInterval(async () => {
      const messages = await  getUnrepliedEmails(auth);
      console.log(`found ${messages.length} unreplied messages`);

  for (const message of messages) {
  await  sendResponse(auth, message);
  console.log(`sent reply to message with id ${message.id}`);

  await addLabel(auth, message, labelId); 
  console.log(`Added label to message with id ${message.id}`);
  } 
  }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000); // Random interval between 45 and 120 seconds
};











