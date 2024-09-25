const express = require('express');
const admin = require('firebase-admin');
const session = require('express-session');
const bcrypt = require('bcrypt'); // You can replace it with bcryptjs if needed
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios'); // For currency conversion API

const app = express();
const PORT = 3001; // Use port 3001 to avoid conflicts

const serviceAccount = require('./signup-4d6af-firebase-adminsdk-pb7j8-567f0485b0.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Setting up the view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'thisisASecret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
}));

app.use(express.static(path.join(__dirname, 'public')));

// Redirect to login if root is accessed
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Render login page
app.get('/login', (req, res) => {
    const loggedOutMsg = req.query.loggedOutMsg || '';
    res.render('login', { loggedOutMsg });
});

// Handle login POST request
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userDoc = await db.collection('users').doc(email).get();
        if (!userDoc.exists) {
            return res.status(400).send('User does not exist');
        }
        const user = userDoc.data();
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.userId = userDoc.id;
            req.session.username = user.username;
            // Redirect to form.ejs after successful login
            res.redirect('/convert');
        } else {
            res.status(400).send('Incorrect Password');
        }
    } catch (error) {
        res.status(500).send('Error logging in user');
    }
});

// Render signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Handle signup POST request
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const userDoc = await db.collection('users').doc(email).get();
        if (userDoc.exists) {
            return res.status(400).send('User already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').doc(email).set({
            username,
            email,
            password: hashedPassword
        });
        // Redirect to form.ejs after successful signup
        res.redirect('/convert');
    } catch (error) {
        res.status(500).send('Error signing up user');
    }
});

// Render form.ejs (Currency Converter) after login/signup
app.get('/convert', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.render('form', { serverOutput: "" });
});

// Handle currency conversion POST request
app.post('/convert', (req, res) => {
    let currency = parseInt(req.body.currency);
    let from = req.body.currencyFrom;
    let to = req.body.currencyTo;

    let url = `https://api.freecurrencyapi.com/v1/latest?apikey=fca_live_zkYoCgQCkMIBnwk0wgv2OqlSgZLlczk7kOWRuCM4&currencies=${from}%2C${to}`;

    axios.get(url)
        .then((response) => {
            const rate = response.data.data[to];
            const convertedAmount = currency * rate;
            res.render('form', { serverOutput: convertedAmount });
        })
        .catch((error) => {
            console.error("Error fetching data from API:", error);
            res.render('form', { serverOutput: "Error fetching data from API" });
        });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login?loggedOutMsg=You have been logged out');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
