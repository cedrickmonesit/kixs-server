require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// api security 
const { expressjwt: jwt } = require('express-jwt'); 
// deconstruct from express-jwt object if you add const { expressjwt: jwt } = require('express-jwt'); it will not work and throw TypeError: jwt is not a function

const jwks = require('jwks-rsa');

const jwtScope = require('express-jwt-scope');// makes it easy to setup scope and check them as middleware

const { initializeApp,applicationDefault,cert, } = require("firebase-admin/app");

const { getFirestore,Timestamp,FieldValue, } = require("firebase-admin/firestore");

const serviceAccount = require(process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH); // service account for firestore athentication access

// initialize firestore
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const PORT = process.env.PORT || 4000; // process.PORT checks if PORT is defined in env file if not it will use PORT 4000

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
  secret: jwks.expressJwtSecret({ // verifies if token has this public secret
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: process.env.AUTH0_JWKSURI
  }),
  audience: process.env.AUTH0_AUDIENCE, // verifies that the token is for this audience
  issuer: process.env.AUTH0_ISSUER, // verifies that the token is from this issuer
  algorithms: [process.env.AUTH0_ALGORITHMS]
});

app.use(jwtCheck); // using jwtCheck as middleware

// jwtScope middleware checks an array of scopes that has to be verified anyone who accesses this endpoints 
app.get("/members", jwtScope('read:members'),(request, response) => {
  const subId = request.auth.sub.split("|").pop();
  console.log(subId);
  /*
  const docRef = db.collection("users").doc(subId); // setting collection and document in firestore database
  // setting document with values
  let addData = async () => {
    await docRef.set({
      first: "Cedrick",
      last: "Monesit",
      born: 2001,
    });
  };
  addData();
  */

  const userRef = db.collection('users').doc(subId);
  async function databasetest() {
    const doc = await userRef.get();
    if (!doc.exists) {
      console.log('No such document!');
    } else {
      console.log('Document data:', doc.data());
    }
  }


 databasetest();
 response.status(200).json("Success");

});

app.delete("/:id", (request, response) => {
  response.status(200).json({ members: filteredMembers });
});

const docRef = db.collection("users").doc("alovelace"); // setting collection and document in firestore database

// setting document with values
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

app.listen(PORT, () => console.log(`Server running ${PORT}`));
