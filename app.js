const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// api security
const { expressjwt: jwt } = require("express-jwt");
// deconstruct from express-jwt object if you add const { expressjwt: jwt } = require('express-jwt'); it will not work and throw TypeError: jwt is not a function

const jwksRsa = require("jwks-rsa");

const jwtScope = require("express-jwt-scope"); // makes it easy to setup scope and check them with middleware

const { initializeApp, applicationDefault, cert } = require("firebase-admin/app");

const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

//google cloud storage
const { Storage } = require("@google-cloud/storage");

// multer
const Multer = require("multer");

// initialize firestore
initializeApp({
  credential: cert({
    project_id: "kixs-1d4f3",
    private_key_id: "6c9829937305027d54eac286a069e46b511410c9",
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
    client_email: "firebase-adminsdk-2u33w@kixs-1d4f3.iam.gserviceaccount.com",
    client_id: "100303831849452795178",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-2u33w%40kixs-1d4f3.iam.gserviceaccount.com",
  }),
});

// initialize firebase storage
const storage = new Storage({
  project_id: "kixs-1d4f3",
  private_key_id: "6c9829937305027d54eac286a069e46b511410c9",
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
  client_email: "firebase-adminsdk-2u33w@kixs-1d4f3.iam.gserviceaccount.com",
  client_id: "100303831849452795178",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-2u33w%40kixs-1d4f3.iam.gserviceaccount.com",
});

const db = getFirestore();

const bucket = storage.bucket("kixs-1d4f3.appspot.com");

const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb; change as needed.
  },
});

const PORT = process.env.PORT || 4000; // process.PORT checks if PORT is defined in env file if not it will use PORT 4000

app.use(express.json()); // allows us to use Express.js built in body parser

app.use(helmet()); // adding helmet to enhance API's security

app.use(bodyParser.json()); // using bodyParser to parse JSON bodies into JS objects

app.use(
  cors({
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "Origin"], // you can change the headers
    exposedHeaders: ["authorization"], // you can change the headers
    origin: "https://cedrickmonesit.github.io",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,PATCH",
    credentials: true,
    preflightContinue: true,
  }),
); // enabling CORS all request

app.use(morgan("combined")); // adding morgan to log HTTP requests

//GET method expects two arguments the first is the route
// the second is a callback function that contains the code that will be executed when the route is hit by our client.
app.get("/", (request, response) => {
  //response.status(200).json({ members: members }); // chaining two methods to the response object the first method status sends the status code of 200 meaning it was successful. The status method is not required but it's good practice to use it so the client can be able to show a different UI to the user for better UX.
  // the second method in the chain is json defines the data format sending back to our client. We are sending a JSON object.

  response.json({ message: "Kixs API" });
});

//middle ware to check and authorize access token from the request made by the frontend application
const authorizeAccessToken = jwt({
  secret: jwksRsa.expressJwtSecret({
    // verifies if token has this public secret
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.AUTH0_JWKSURI,
  }),
  audience: process.env.AUTH0_AUDIENCE, // verifies that the token is for this audience
  issuer: process.env.AUTH0_ISSUER, // verifies that the token is from this issuer
  algorithms: [process.env.AUTH0_ALGORITHMS], // used to decode token
});
//app.use(jwtCheck); // using jwtCheck as middleware

// property name of where roles/permissions are found
// the access token is being passed into jwtScope which has a scope property and permissions property
let options = {
  scopeKey: "permissions", //default scopeKey is "scope" which is not set by roles/permissions in the Auth0 users dashboard
};

//send data
let sendData = async (docRef, data = {}) => {
  await docRef.set({ ...data });
};

//update data
let updateData = async (docRef, data = {}) => {
  await docRef.update({ ...data });
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
    if (doc.exists) {
      //returns a pending promise
      return doc.data();
    } else {
      //returns a rejected promise
      return Promise.reject("No such document");
    }
  });
};

/*
  Function to upload image file to Google storage
  the file object will be uploaded to Google storage
  @param {object} image file
  @param {string} product id used for uploading image file reference
  @param {integer} index from foreach loop
  @return {Promise} returns a promise that needs to be handled
*/
const uploadImageToStorage = (file, productId, index) => {
  // return promise
  return new Promise((resolve, reject) => {
    // promise reject if file doesn't exist
    if (!file) {
      reject("No image file");
    }

    // create new file name with product id and index
    let newFileName = `${productId}_image-${index}`;

    let fileUpload = bucket.file(newFileName);

    // create binary large object stream for image file upload
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        // media type two part identifier for file formats and format contents transmitted on the internet
        contentType: file.mimetype,
      },
    });

    // blobStream error promise reject with error
    blobStream.on("error", (error) => {
      reject(error);
    });

    // blobstream finishes
    blobStream.on("finish", () => {
      //resolve promise return true boolean
      resolve(true);
    });

    blobStream.end(file.buffer);
  });
};

/* Endpoints */

app.post("/add-user", authorizeAccessToken, (request, response) => {
  // add user subId to firestore database as document name for reference

  // Auth0 user sub id used for querying and sending data to database
  const subId = request.auth.sub.split("|").pop();

  // create users collection with document name as user subId
  const docRef = db.collection("users").doc(subId);

  // favorites list data
  const data = {
    products: [],
  };

  sendData(docRef, data);

  // status 201 new resource was created
  response.status(201).json({ success: true, message: "User was added to the database" });
});

app.post("/favorites/add-product", authorizeAccessToken, async (request, response) => {
  // Auth0 user sub id used for querying and sending data to database
  const subId = request.auth.sub.split("|").pop();

  // product id that will be added to the favorites list
  const productId = request.body.id;

  // referencing document with user subId that contains user favorites list
  const docRef = db.collection("users").doc(subId);

  // retrieve user's favorites list
  const favorites = await getData(docRef)
    .then((data) => {
      // favorites list
      return { success: true, products: data.products };
    })
    //handles rejected promise
    .catch((error) => {
      //error message
      return { success: false, error: error, message: "Error" };
    });

  //check if retrieval of the favorites list was successful
  if (favorites.success) {
    // check if product is not in the favorites list
    if (!favorites.products.includes(productId)) {
      // add product id to favorites list
      favorites.products.push(productId);

      // favorites data to be sent to the firestore database
      const data = {
        // destructure favorites list
        products: favorites.products,
      };

      // update favorites list with favorites list
      updateData(docRef, data);

      // status 201 new resource was created
      response.status(201).json({
        success: true,
        message: "Product was added to the user's favorites list",
      });
    } else {
      // status 200 request successful
      response.status(201).json({
        success: false,
        message: "Product is already in the user's favorites list",
      });
    }
  } else {
    //status 409 conflict
    response.status(409).json(favorites);
  }
});

app.delete("/favorites/remove-product", authorizeAccessToken, async (request, response) => {
  // Auth0 user sub id used for querying and sending data to database
  const subId = request.auth.sub.split("|").pop();

  // product id that will be added to the favorites list
  const productId = request.body.id;

  // referencing document with user subId that contains user favorites list
  const docRef = db.collection("users").doc(subId);

  // retrieve user's favorites list
  const favorites = await getData(docRef)
    .then((data) => {
      // favorites list
      return { success: true, products: data.products };
    })
    //handles rejected promise
    .catch((error) => {
      //error message
      return { success: false, error: error, message: "Error" };
    });

  //check if retrieval of the favorites list was successful
  if (favorites.success) {
    // check if product is not in the favorites list
    if (favorites.products.includes(productId)) {
      // remove product id to favorites list
      const newFavorites = [];
      favorites.products.forEach((product) => {
        if (productId != product) {
          newFavorites.push(product);
        }
      });
      // favorites data to be sent to the firestore database
      const data = {
        // destructure favorites list
        products: newFavorites,
      };

      // update favorites list with favorites list
      updateData(docRef, data);

      // status 201 new resource was created
      response.status(201).json({
        success: true,
        message: "Product was removed from the user's favorites list",
      });
    } else {
      // status 200 request successful
      response.status(201).json({
        success: false,
        message: "Product is not in the user's favorites list",
      });
    }
  } else {
    //status 409 conflict
    response.status(409).json({ ...favorites });
  }
});

// get user's favorites list
app.get("/favorites", authorizeAccessToken, async (request, response) => {
  // Auth0 user sub id used for querying and sending data to database
  const subId = request.auth.sub.split("|").pop();
  console.log(subId);

  // referencing document with user subId that contains user favorites list
  const docRef = db.collection("users").doc(subId);

  // retrieve user's favorites list
  await getData(docRef)
    // favorites list
    .then((data) => {
      // using product ids get products from database
      const productList = [...data.products];

      // docRef
      const docRef = db.collection("products");

      // Array.map() returns array with all the product data
      // products will be an array of promises containing all the product data
      const products = productList.map(async (productId) => {
        // function getData()
        // @returns {Promise} returns a promise that has the product data
        return (data = await getData(docRef.doc(productId)));
      });

      // handle products array of Promises
      Promise.all(products)
        // handle resolve
        .then((data) => {
          // product data
          response.status(200).json({
            success: true,
            products: data,
            message: "Product list has been retrieved",
          });
        })
        // handle reject
        .catch((error) => {
          response.status(200).json({
            success: false,
            error: error,
            message: "Failed to retrieve product list",
          });
        });
    })
    //handles rejected promise
    .catch((error) => {
      // error message
      return { success: false, error: error, message: "Error" };
    });
});

// get all products
app.get("/products", async (request, response) => {
  const snapshot = await db.collection("products").get();
  const products = snapshot.docs.map((doc) => doc.data());

  // status 200 request successful
  response.status(200).json({ success: true, products: [...products] });
});

app.get("/products/search/:value", async (request, response) => {
  const param = request.params.value;
  var value = param.replace(/-/g, " ");

  const snapshot = await db
    .collection("products")
    .where("primaryName", ">=", value)
    .where("primaryName", "<=", value + "z")
    .get();
  const products = snapshot.docs.map((doc) => doc.data());
  // status 200 request successful
  response.status(200).json({ success: true, products: [...products] });
});
// jwtScope middleware checks if the headers for the property Authorization which has the accessToken. The access token has a property called "permissions" which has the role/permissions for the signed in user in the frontend.
app.get("/authorization", authorizeAccessToken, jwtScope("access:admin", options), (request, response) => {
  // send response back to frontend that the user has permission to access this endpoint
  // React frontend will handle the response from the backend to give user access to the role based route mounting the component
  // status 200 is for GET requests
  response.status(200).json({ success: true, authorized: true, message: "Authorized" });
});

/*
  function uploads product images
  @param {object} request object from /save-product endpoint
  @param {string} product id
  request.files is an array of image files
  request.body will contain the text fields
*/
let uploadProductImages = (request, id) => {
  // image file from request
  let images = request.files;

  // upload each image to firebase storage
  images.forEach((image, index) => {
    // if image exists
    if (image) {
      // handle promise resolve and reject
      uploadImageToStorage(image, id, index)
        .then((message) => {
          // handles promise resolve
          console.log(message);
        })
        .catch((error) => {
          // catch handles promise reject
          console.log(error);
        });
    }
  });
};

// retrieve all uploaded URL images from firebase storage to store in the firestore database

/*
  function retrieve image URL
  @param {string} fileName
  @return {Promise} returns a URL promise
*/
let generateUrl = (fileName) => {
  console.log(fileName);
  return new Promise((resolve) => {
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileName}?alt=media`;
    console.log(url);
    resolve(url);
  }).catch((err) => {
    console.log(err);
  });
};

/* 
  function loops through images and returns an array of promises
  @param {string} product id
  @param {Array} image files from the request.files
  @return {Array} returns an array of promises
*/
let generateUrlArray = (id, images) => {
  let urls = [];
  for (let i = 0; i < images.length; i++) {
    urls.push(generateUrl(`${id}_image-${i}`));
  }

  return urls;
};

// save product data
app.post("/save-product", authorizeAccessToken, jwtScope("access:admin", options), multer.array("images", 5), (request, response) => {
  const product = request.body;

  //product name
  const primaryName = product.primaryName;

  const secondaryName = product.secondaryName;

  //product variant
  const variant = product.variant;

  //product msrp
  const msrp = product.msrp;

  //product release date
  const releaseDate = product.releaseDate;

  //product colorway
  const colorway = product.colorway;

  // product description
  const description = product.description;

  //product ID
  //creates unique product ID string
  const productId = Math.random().toString(36).substring(7);

  //upload product images from request to firebase storage
  uploadProductImages(request, productId);

  //generate image url array to store in the firestore database
  const urls = generateUrlArray(productId, request.files);
  console.log(urls);
  /*
     send product data to firestore database
     @param {Array} image urls array
   */
  let sendProductData = (urls = []) => {
    //product data
    const data = {
      primaryName: `${primaryName}`,
      secondaryName: `${secondaryName}`,
      description: `${description}`,
      releaseDate: `${releaseDate}`,
      variant: `${variant}`,
      colorway: `${colorway}`,
      msrp: msrp,
      id: `${productId}`,
      images: [...urls],
    };

    const docRef = db.collection("products").doc(productId);

    sendData(docRef, data);

    // status 201 is for POST & PUT requests
    response.status(201).json({
      success: true,
      authorized: true,
      message: "Product data was sent to the database",
    });
  };

  // handle the array of promises for the product image URLS
  Promise.all(urls)
    .then((imageUrls) => {
      sendProductData(imageUrls);
    }) // handle promise reject
    .catch((error) => {
      console.log(error);
      response.status(201).json({
        success: false,
        authorized: true,
        message: "Product data was not sent to the database",
        error: error,
      });
    });
});

// update product data
app.put("/update-product", authorizeAccessToken, jwtScope("access:admin", options), (request, response) => {
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
    msrp: productMsrp,
  };

  const docRef = db.collection("products").doc(productId);

  updateData(docRef, data);

  // status 201 is for POST & PUT requests
  response.status(201).json({ success: true, authorized: true, message: "Success" });
});

// delete product with id
app.delete("/delete-product", authorizeAccessToken, jwtScope("access:admin", options), (request, response) => {
  //product
  const product = request.body;

  //product ID
  const productId = product.id;

  const docRef = db.collection("products").doc(productId);

  async function deleteFile(index) {
    let fileName = `${productId}_image-${index}`;
    await bucket.file(fileName).delete();

    console.log(`${fileName} deleted`);
  }

  getData(docRef)
    .then((data) => {
      const images = data.images;
      images.forEach((image, index) => {
        deleteFile(index).catch((error) => {
          console.log(error);
        });
      });
    })
    .catch((error) => {
      console.log(error);
    });

  //delete product data from database
  deleteData(docRef);

  response.status(200).json({
    success: true,
    authorized: true,
    message: "Product data and image has been deleted from the database",
  });
});

// get product with id
app.get("/products/:id", async (request, response) => {
  // using product id get product from database
  const productId = request.params.id;

  //docRef
  const docRef = db.collection("products").doc(productId);

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
      return { error: error, message: "Error" };
    });

  response.status(200).json({
    success: true,
    data: data,
    message: "Product data has been retrieved",
  });
});

// list of products in favorites list
app.post("/products/list", (request, response) => {
  // using product ids get products from database
  const productList = request.body.productList;

  // docRef
  const docRef = db.collection("products");

  // Array.map() returns array with all the product data
  // products will be an array of promises containing all the product data
  const products = productList.map(async (productId) => {
    // function getData()
    // @returns {Promise} returns a promise that has the product data
    return (data = await getData(docRef.doc(productId)));
  });

  // handle products array of Promises
  Promise.all(products)
    // handle resolve
    .then((data) => {
      // product data
      response.status(200).json({
        success: true,
        products: data,
        message: "Product list has been retrieved",
      });
    })
    // handle reject
    .catch((error) => {
      response.status(200).json({
        success: false,
        error: error,
        message: "Failed to retrieve product list",
      });
    });
});

app.listen(PORT, () => console.log(`Server running ${PORT}`));
