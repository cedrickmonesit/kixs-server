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

const jwksRsa = require('jwks-rsa');

const jwtScope = require('express-jwt-scope');// makes it easy to setup scope and check them with middleware

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

//middle ware to check and authorize access token from the request made by the frontend application
const authorizeAccessToken = jwt({
  secret: jwksRsa.expressJwtSecret({ // verifies if token has this public secret
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: process.env.AUTH0_JWKSURI
  }),
  audience: process.env.AUTH0_AUDIENCE, // verifies that the token is for this audience
  issuer: process.env.AUTH0_ISSUER, // verifies that the token is from this issuer
  algorithms: [process.env.AUTH0_ALGORITHMS] // used to decode token
});
//app.use(jwtCheck); // using jwtCheck as middleware

// property name of where roles/permissions are found
// the access token is being passed into jwtScope which has a scope property and permissions property
let options = {
  scopeKey: 'permissions' //default scopeKey is "scope" which is not set by roles/permissions in the Auth0 users dashboard
}

//send data
let sendData = async (docRef, data = {}) => {
  await docRef.set({...data});
};

//update data 
let updateData = async (docRef, data = {}) => {
  await docRef.update({...data});
};

//delete data
let deleteData = async (docRef) => {
  await docRef.delete();
};

//get data
let getData = (docRef) => {
  //return promise
  return docRef.get().then((doc) => {
    //check if the document exists
    if(doc.exists){

      //returns a pending promise
      return doc.data();

    }else {

      //returns a rejected promise
      return Promise.reject("No such document");
    }
  });
};

app.get("/favorites", authorizeAccessToken, (request, response) => {
  const favorites = ["Jordan 1", "Jordan 4", "Jordan 11"];
  response.send(favorites);
});

// jwtScope middleware checks if the headers for the property Authorization which has the accessToken. The access token has a property called "permissions" which has the role/permissions for the signed in user in the frontend.
app.get("/authorization", authorizeAccessToken, jwtScope('access:admin', options), (request, response) => {

  // Auth0 user sub id used for querying and sending data to database
  const subId = request.auth.sub.split("|").pop();

  // send response back to frontend that the user has permission to access this endpoint
  // React frontend will handle the response from the backend to give user access to the role based route mounting the component
  // status 200 is for GET requests
  response.status(200).json({authorized: true, message: "Authorized"});

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


  // Query database for correct data using user sub id from the frontend request
  /*
  const userRef = db.collection('users').doc(subId);
  async function getUserData() {
    const doc = await userRef.get();
    if (!doc.exists) {
      console.log('No such document!');
    } else {
      console.log('Document data:', doc.data());
      response.status(200).json(doc.data());
    }
  }
  getUserData();
  */

});

app.post("/save-product", authorizeAccessToken, jwtScope('access:admin', options), (request, response) => {
  console.log(request.body);

  const product = request.body;

  //product name
  const productName = product.name;

  //product variant
  const productVariant = product.variant;

  //product msrp
  const productMsrp = product.msrp;

  //product ID
  //creates unique product ID string
  const productId = Math.random().toString(36).substring(7);

  //product data
  const data = {
    name: `${productName}`,
    variant: `${productVariant}`,
    msrp: productMsrp,
    id: `${productId}`
  };

  const docRef = db.collection("products").doc(productId);

  sendData(docRef, data);

  // status 201 is for POST & PUT requests
  response.status(201).send({authorized: true, message: "Success"});
});

app.put("/update-product", authorizeAccessToken, jwtScope('access:admin', options), (request, response) => {
  //update product data in database
  const product = request.body;

  //product name
  const productName = product.name;

  //product variant
  const productVariant = product.variant;

  //product msrp
  const productMsrp = product.msrp;

  //product ID
  const productId = product.id;

  //update product data in database
  //product data
  const data = {
    name: `${productName}`,
    variant: `${productVariant}`,
    msrp: productMsrp
  };

  const docRef = db.collection("products").doc(productId);

  updateData(docRef, data);

  // status 201 is for POST & PUT requests
  response.status(201).send({authorized: true, message: "Success"});
});

app.delete("/delete-product", authorizeAccessToken, jwtScope('access:admin', options), (request, response) => {
  //product 
  const product = request.body;

  //product ID
  const productId = product.id;

  const docRef = db.collection("products").doc(productId);

  //delete product data from database
  deleteData(docRef);

  response.status(200).send({authorized: true, message: "Success"});
});

app.get("/product/:id", async (request, response) => {
  // using product id get product from database
  const productId = request.params.id

  //docRef
  const docRef = db.collection('products').doc(productId);

  //getData returns a promise
  //await the promise that getData() returns
  const data = await getData(docRef)
  //handles resolved and rejected promises
  //first parameter of .then() method is a callback function for a resolved promise second parameter is a callback for a rejected promise
  //in this case the second argument for the rejected promises is undefined and is being handled by .catch()
  .then((data) => {
    //product data
    return data;
  })
  //handles rejected promise
  .catch((error) => {
    return {error: error, message: "Error"};
  })

  response.status(200).send({data: data, message: "Success"});
});

app.listen(PORT, () => console.log(`Server running ${PORT}`));
