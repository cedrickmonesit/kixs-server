const express = require("express");
const members = require("./members"); //requiring the members.js file

const app = express();

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");

const serviceAccount = require("./keys/kixs-1d4f3-9113c3eb4bdd.json"); // service account for athentication access

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const PORT = process.env.PORT || 4000; // process.env.PORT checks if PORT is defined in env file if not it will use PORT 4000

app.use(express.json()); // allows us to use Express.js built in body parser

//GET method expects two arguments the first is the route
// the second is a callback function that contains the code that will be executed when the route is hit by our client.
app.get("/", (request, response) => {
  response.status(200).json({ members: members }); // chaining two methods to the response object the first method status sends the status code of 200 meaning it was successful. The status method is not required but it's good practice to use it so the client can be able to show a different UI to the user for better UX.
  // the second method in the chain is json defines the data format sending back to our client. We are sending a JSON object.
});

app.post("/", (request, response) => {
  const newMember = {
    id: request.body.id,
    name: request.body.name,
    age: request.body.age,
  };
  members.push(newMember); // Add new member to members array
  response.status(200).json({ members: members }); // send back to client to show new members list
});

app.delete("/:id", (request, response) => {
  const filteredMembers = members.filter(
    (member) => member.id !== parseInt(request.params.id), //filters member by id if member.id is not the request member id add it to the filteredMembers
  );
  response.status(200).json({ members: filteredMembers });
});

const docRef = db.collection("users").doc("alovelace"); // setting collection and document in firestore database

let addData = async () => {
  await docRef.set({
    first: "Ada",
    last: "Lovelace",
    born: 1815,
  });
};

addData();

app.listen(PORT, () => console.log(`Server runnong ${PORT}`));
