const express = require('express')
const app = express()
const serviceAccount =require('./doctor-health-firebase-adminsdk.json');
const fileUpload = require('express-fileupload')
require('dotenv').config();
const admin = require("firebase-admin");

const { MongoClient, Admin } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const objectId = require('mongodb').ObjectId;

const port = process.env.PORT ||5000
const cors= require('cors')




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use(express.json());
app.use(fileUpload())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5efbm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri)
async function verifyToken(req,res,next){
	if(req.headers?.authorization?.startsWith('bearer ')){
		const token = req.headers.authorization.split(' ')[1];


		try{
			const decodedUser = await admin.auth().verifyIdToken(token);
			req.decodedEmail = decodedUser.email;
			console.log(decodedUser)
		}
		catch{

		}


	}

	next()
}

async function run(){
	try{
		await client.connect();
		const database = client.db("doctor_data")
		const appointmentsCollection = database.collection("appointments")
		const userCollection = database.collection("users");
		const doctorsCollection = database.collection("doctors")
		
		app.get('/appointments',verifyToken,async (req,res)=>{
			const email = req.query.email;
			const date = new Date(req.query.date).toDateString();
			console.log(date)
			const query = {email:email,date:date}
			
			const cursor = appointmentsCollection.find(query);
			const appointments = await cursor.toArray();
			res.json(appointments)
		});
		

		app.get('/users/:email',async(req,res)=>{
			const email = req.params.email;
			const query ={email:email};
			const user = await userCollection.findOne(query);
			let isAdmin = false ;
			if(user?.role === 'admin'){
				isAdmin= true;
			}
			res.json({admin:isAdmin});
		});


		app.get('/appointments/:id',async(req,res)=>{
			const id = req.params.id;
			const query = {_id:objectId(id)};
			const result = await appointmentsCollection.findOne(query)
			res.json(result)
		})


		app.post('/appointments',async(req,res)=>{
			const appointment = req.body;
			const result = await appointmentsCollection.insertOne(appointment)
			console.log(appointment)

			res.json(result)
		})
		app.post('/users',async(req,res)=>{
			const user = req.body;
			const result = await userCollection.insertOne(user)
			console.log(result)
			res.json(result)
		});
	
		app.put('/users', async(req,res)=>{
			const user = req.body;
			
			const filter = {email: user.email};
			const options = { upsert: true };
			const updateDoc ={$set: user };
			const result = await userCollection.updateOne(filter,updateDoc,options);
			res.json(result)
		});
		app.get('/doctors',async(req,res)=>{
			const cursor = doctorsCollection.find({});
			const doctors = await cursor.toArray();
			res.json(doctors)
		})
		app.post('/doctors',async(req,res)=>{
			const name = req.body.name;
			const email = req.body.email;
			const pic = req.files.image;
			const picData =pic.data;
			const encodedPic = picData.toString('base64')
			const imageBuffer = Buffer.from(encodedPic,'base64');
			const doctor={
				name,
				email,
				image:imageBuffer
			}
			const result = await doctorsCollection.insertOne(doctor)
			
			
			res.json(result)
		});
		app.put('/users/admin',verifyToken, async (req,res)=>{
			const user = req.body;
			
			const requester= req.decodedEmail;

			if(requester){
				const requestAccount = await userCollection.findOne({email:requester});

				if(requestAccount.role === 'admin'){
					const filter = {email: user.email};
					const updateDoc = {$set:{role:'admin'}};
					const result = await userCollection.updateOne(filter,updateDoc)
					res.json(result);
				};

			}
			else{
				res.status(403).json({message:'your did not access to the make admin'})
			}
			

			
		});

		app.post('/create-payment-intent',async(req,res)=>{
			const paymentInfo = req.body;
			const amount = paymentInfo.price * 100;
			const paymentIntent = await stripe.paymentIntents.create({
				currency:'usd',
				amount : amount,
				payment_method_types:['card']
			
			});
			res.json({
				clientSecret: paymentIntent.client_secret});
		});

	}
	finally{
		// await client.close();
	}


	
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World connect to database')
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
  })