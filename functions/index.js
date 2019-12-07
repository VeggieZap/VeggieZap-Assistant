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

admin.initializeApp()
const db = admin.firestore()
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

app.intent('add to cart', conv => {
      return new Promise((resolve, reject) => {
            console.log("EMAIL", conv.user.email)

            db.collection('users').doc(conv.user.email).collection('cart').get()
                  .then(docSnapshots => {
                        var cartItems = []

                        console.log("SNAP", docSnapshots)

                        docSnapshots.forEach(docSnapshot => {
                              console.log("TAG", docSnapshot.data())
                              cartItems.push({
                                    name: docSnapshot.data().name,
                                    price: docSnapshot.data().price,
                                    quantity: docSnapshot.data().quantity
                              })
                        })

                        var listOptions = {}

                        cartItems.forEach((item, i) => {
                              listOptions[`KEY_${i}`] = {
                                    title: item.name,
                                    description: `${item.price}, ${item.quantity}`,
                                    image: new Image({
                                          url: IMG_URL,
                                          alt: "accessibility text"
                                    })
                              }
                        })

                        console.log("LIST OPTIONS", listOptions)

                        var response = new Carousel({
                              title: 'Your Cart for today',
                              items: listOptions
                        })
                        conv.ask('These are your items, What do you want to add?')
                        conv.ask(response)

                        resolve()
                        return null
                  })
                  .catch(err => {
                        console.log(err)
                        throw err
                  })

      })
})

app.intent('add to cart - item', async (conv, params) => {
      conv.ask(`Sure, ${params.amount} of ${params.any} are added to your cart, Say finish cart to finish adding items`)

      var toAsk = await displayCart(conv)
      conv.ask(toAsk)
      conv.ask(new Suggestions(['Finish cart', 'Add another item']))
})

async function displayCart(conv) {
      var snapshots = await db.collection('users').doc(conv.user.email).collection('cart').get()
      var cartItems = []

      console.log("SNAP", snapshots)

      snapshots.forEach(docSnapshot => {
            console.log("TAG", docSnapshot.data())
            cartItems.push({
                  name: docSnapshot.data().name,
                  price: docSnapshot.data().price,
                  quantity: docSnapshot.data().quantity
            })
      })

      var listOptions = {}

      cartItems.forEach((item, i) => {
            listOptions[`KEY_${i}`] = {
                  title: item.name,
                  description: `${item.price}, ${item.quantity}`,
                  image: new Image({
                        url: IMG_URL,
                        alt: "accessibility text"
                  })
            }
      })

      console.log("LIST OPTIONS", listOptions)

      var response = new Carousel({
            title: 'Your Cart for today',
            items: listOptions
      })

      return Promise.resolve(response)
}

exports.veggieZap = functions.https.onRequest(app)