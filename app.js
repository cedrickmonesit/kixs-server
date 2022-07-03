const express = require("express");
const members = require("./members"); //requiring the members.js file
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// api security 
const { expressjwt: jwt } = require('express-jwt'); 
// deconstruct from express-jwt object if you add const { expressjwt: jwt } = require('express-jwt'); it will not work and throw TypeError: jwt is not a function

const jwks = require('jwks-rsa');

const { initializeApp,applicationDefault,cert, } = require("firebase-admin/app");

const { getFirestore,Timestamp,FieldValue, } = require("firebase-admin/firestore");

const serviceAccount = require("./keys/kixs-1d4f3-9113c3eb4bdd.json"); // service account for athentication access

// initialize firestore
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const PORT = process.env.PORT || 4000; // process.env.PORT checks if PORT is defined in env file if not it will use PORT 4000

const ads = [
  { title: "Hello, world!" }
];

app.use(express.json()); // allows us to use Express.js built in body parser

app.use(helmet()); // adding helmet to enhance API's security

app.use(bodyParser.json()); // using bodyParser to parse JSON bodies into JS objects

app.use(cors()); // enabling CORS all request

app.use(morgan("combined")); // adding morgan to log HTTP requests

//GET method expects two arguments the first is the route
// the second is a callback function that contains the code that will be executed when the route is hit by our client.
app.get("/", (request, response) => {
  //response.status(200).json({ members: members }); // chaining two methods to the response object the first method status sends the status code of 200 meaning it was successful. The status method is not required but it's good practice to use it so the client can be able to show a different UI to the user for better UX.
  // the second method in the chain is json defines the data format sending back to our client. We are sending a JSON object.

  response.send(ads);
});


const jwtCheck = jwt({
  secret: jwks.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'https://dev-uuh22p8d.us.auth0.com/.well-known/jwks.json'
  }),
  audience: 'https://kixs-api',
  issuer: 'https://dev-uuh22p8d.us.auth0.com/',
  algorithms: ['RS256']
});

app.use(jwtCheck);

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

/*
addData();
*/

app.listen(PORT, () => console.log(`Server runnong ${PORT}`));
