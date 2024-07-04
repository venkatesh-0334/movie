const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const bcrypt = require('bcrypt');
const https = require('https');

const app = express();
const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
app.set('view engine', 'ejs');1
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const saltRounds = 10;
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await db.collection('users').where('email', '==', email).get();

    if (!existingUser.empty) {
      console.log('Email already exists:', email);
      return res.status(400).send('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.collection('users').add({
      email,
      password: hashedPassword,
    });

    console.log('User signed up:', email);

    res.redirect('/login');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userQuery = await db.collection('users').where('email', '==', email).get();

    if (userQuery.empty) {
      console.log('Invalid email or password:', email);
      return res.status(401).send('Invalid email or password');
    }

    const userData = userQuery.docs[0].data();
    const hashedPassword = userData.password;

    const passwordMatch = await bcrypt.compare(password, hashedPassword);

    if (passwordMatch) {
      console.log('User logged in:', email);
      res.redirect('/dashboard'); 
    } else {
      console.log('Invalid email or password:', email);
      res.status(401).send('Invalid email or password');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

const omdbApiKey = 'cc6c19de';

function fetchMovies(searchTerm, callback) {
  const url = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${omdbApiKey}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, JSON.parse(data));
    });
  }).on('error', (err) => {
    callback(err);
  });
}

app.get('/dashboard', (req, res) => {
  const searchTerm = req.query.search || 'batman'; 
  fetchMovies(searchTerm, (error, data) => {
    if (error) {
      console.error('Error fetching movies:', error);
      return res.status(500).send('Error fetching movies');
    }

    if (!data.Search || data.Search.length === 0) {
      console.log('No movies found for:', searchTerm);
      return res.render('dashboard', { movies: [] }); 
    }

    res.render('dashboard', { movies: data.Search });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
