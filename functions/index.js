'use strict'

const {
      dialogflow,
      Permission,
      SignIn,
      Suggestions,
      Carousel,
      List,
      Image,
      SimpleResponse
} = require('actions-on-google')
const functions = require('firebase-functions')
const config = require('./config')
const admin = require('firebase-admin')
const firebase = require('firebase')

const firebaseConfig = config.veggieZapFirebaseConfig
firebase.initializeApp(firebaseConfig)
// admin.initializeApp(functions.config().firebase)
// const db = admin.firestore()
const db = firebase.firestore()
const IMG_URL = 'https://www.vegsoc.org/wp-content/uploads/2019/03/vegetable-box-750x580.jpg'

const app = dialogflow({
      debug: true,
      clientId: config.clientId
})

app.intent('Default Welcome Intent', (conv) => {
      const payload = conv.user.profile.payload
      if (typeof payload === 'undefined') {
            return conv.ask(new SignIn('To get your email'))
      } else {
            conv.ask(new Suggestions(['View your cart', 'Modify cart', 'Add to cart']))
            return conv.ask(new SimpleResponse({
                  speech: "Pick any or say any of the options",
                  text: "Click any or say any of the options"
            }))
      }
})

app.intent('sign in confirmation', (conv, params, signin) => {
      if (signin.status !== 'OK') {
            return conv.close("Please try again")
      }
      conv.data.payload = conv.user.profile.payload
      conv.data.email = conv.user.profile.payload.email

      console.log(conv.data.payload)

      conv.ask(new Suggestions(['View your cart', 'Modify cart', 'Add to cart']))
      return conv.ask(new SimpleResponse({
            speech: "Thanks for Signing in!",
            text: "Thanks for signing in, Click any or say any of the options"
      }))
})

app.intent('add to cart', async conv => {
      conv.ask(`This is your cart, What do you want to add?`)
      conv.ask(await displayCart(conv))
})

app.intent('add to cart - item', async (conv, params) => {
      console.log("PARAMS", params.any, params.amount)
      var garb = await addToCart(conv, params.any, params.amount)

      console.log(params.amount, "AMOUNT")

      conv.ask(`Sure, ${params.amount.amount} ${params.amount.unit} of ${params.any} are added to your cart, Say finish cart to finish adding items`)
      // var carouselResponse = await displayCart(conv)

      conv.ask(await displayCart(conv))
      conv.ask(new Suggestions(['Finish cart', 'Add another item']))
})

async function displayCart(conv) {
      var snapshots = await db.collection('users').doc(conv.user.email).collection('cart').get()
      var listOptions = {}

      console.log("SNAP", snapshots)

      var docSnapshots = []
      snapshots.forEach(docSnapshot => { docSnapshots.push(docSnapshot.data()) })

      var promises = []
      docSnapshots.forEach(docSnapshot => {
            promises.push(fetch(`${config.apiEndpoint}&q=${docSnapshot.name}`))
      })

      console.log("PROMISES", promises)

      var responses = await Promise.all(promises)

      console.log("RESPONSES", responses)

      var datas = []
      responses.forEach(response => {
            datas.push(response.json())
      })

      var final = await Promise.all(datas)

      let i = 0
      snapshots.forEach(docSnapshot => {
            console.log("FOR EACH", i, final[i])
            listOptions[`KEY_${docSnapshot.data().name}`] = {
                  title: docSnapshot.data().name,
                  description: `Rs. ${docSnapshot.data().price}, ${docSnapshot.data().quantity} kg`,
                  image: new Image({
                        url: final[i].hits[0].webformatURL,
                        alt: "accessibility text"
                  })
            }
            i++
      })

      // for (var [key, value] of Object.entries(listOptions)) {
      //       var keyword = value.title.split(" ")
      //       keyword = keyword.join("+")

      //       console.log("SENT")
      //       var response = await fetch(`${config.apiEndpoint}&q=${keyword}`)
      //       var data = await response.json()

      //       console.log("GET SENT", data)

      //       var url = data["hits"][0]["webformatURL"]

      //       console.log("URL", url)

      //       value["image"] = new Image({
      //             url: url,
      //             alt: "accessibility text"
      //       })
      // }

      console.log("LIST OPTIONS", listOptions)

      var response
      if (Object.keys(listOptions).length >= 2) {
            response = new Carousel({
                  title: 'Your Cart for today',
                  items: listOptions
            })
      } else {
            var names = []
            // listOptions.forEach((value, key) => {
            //       names.push(value.title)
            // })

            for (var [key, value] of Object.entries(listOptions)) {
                  console.log(key, value, "KEY VALUE")
                  names.push(value.title)
            }

            if (Object.keys(listOptions).length === 1) {
                  response = `You have 1 item in your cart, ${names[0]}`
            } else {
                  response = `You have no items in your cart!`
            }
      }
      return Promise.resolve(response)
}

async function addToCart(conv, item, qty) {
      var itemDetailsCollection = await db.collection('zapper')
            .doc('test@test.com')
            .collection('products')
            .where('name', '==', `${item}`)
            .get()

      console.log("QUERY", itemDetailsCollection.docs)

      var itemDetails
      itemDetailsCollection.forEach(itemDeet => {
            itemDetails = itemDeet.data()
      })
      console.log("ITEM DEETS", itemDetails)

      if (typeof qty === 'undefined') {
            qty = "1"
      } else {
            itemDetails["quantity"] = qty.amount
      }
      itemDetails["date"] = String(Number(new Date()))

      var garb = await db.collection('users').doc(conv.user.email).collection('cart').doc(itemDetails.id).set(itemDetails)
      return Promise.resolve(garb)
}

async function getImageURL(keyword, resolve) {
      keyword = keyword.split(" ")
      keyword = keyword.join("+")

      fetch(`${config.apiEndpoint}&q=${keyword}`)
            .then(response => response.json())
            .then(data => {
                  return resolve(data["hits"][0]["webformatURL"])
            })
            .catch(err => Promise.reject(err))

      var callPromise = await fetch(`${config.apiEndpoint}&q=${keyword}`)
      var response = await callPromise.json()

      console.log("GET", response)

      return Promise.resolve(response["hits"][0]["webformatURL"])
}

exports.veggieZap = functions.https.onRequest(app)
exports.areaAlert = functions.https.onRequest(app)