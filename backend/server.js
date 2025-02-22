const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const app = express();
const port = 5001;

const host = process.env.HOST_URL || 'https://gofile-clone.vercel.app/'; // Replace with your actual domain

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Setup folders
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Files to store IP whitelist and accounts
const whitelistFile = path.join(__dirname, 'whitelisted.json');
const accountsFile = path.join(__dirname, 'accounts.json');
const verificationFile = path.join(__dirname, 'verification.json');

// Initialize whitelist and accounts if they don't exist
if (!fs.existsSync(whitelistFile)) fs.writeFileSync(whitelistFile, JSON.stringify([]));
if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, JSON.stringify([]));
if (!fs.existsSync(verificationFile)) fs.writeFileSync(verificationFile, JSON.stringify({}));

const whitelist = JSON.parse(fs.readFileSync(whitelistFile));
let accounts = JSON.parse(fs.readFileSync(accountsFile));
const verificationTokens = JSON.parse(fs.readFileSync(verificationFile));

// Email transport setup
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gofileclone@gmail.com', // Replace with your email
        pass: 'dqrb vigh hwfz hpum'      // Replace with your app password
    }
});

// Whitelist IP handling
app.post('/whitelist', (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ message: 'IP is required.' });

    if (whitelist.includes(ip)) {
        return res.status(200).json({ message: 'IP already whitelisted.' });
    }

    whitelist.push(ip);
    fs.writeFileSync(whitelistFile, JSON.stringify(whitelist, null, 2));
    console.log(`Whitelisted IP: ${ip}`);
    res.status(200).json({ message: `IP ${ip} whitelisted successfully.` });
});

// File upload handling
const upload = multer({ dest: uploadFolder });

app.post('/upload', upload.single('file'), (req, res) => {
    const ip = req.ip;
    if (!whitelist.includes(ip)) {
        return res.status(403).json({ message: 'Your IP is not whitelisted.' });
    }

    console.log(`File uploaded: ${req.file.filename}`);
    const downloadLink = `${host}/uploads/${req.file.filename}`;
    res.status(200).json({ downloadLink });
});

// Email verification sending
function sendVerificationEmail(email, token) {
    const verificationLink = `${host}/verify/${token}`;

    const mailOptions = {
        from: 'gofileclone@gmail.com',
        to: email,
        subject: 'Email Verification for Gofile Clone',
        text: `Click the link to verify your email: ${verificationLink}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Verification email sent:', info.response);
        }
    });
}

// User registration with email verification and profile picture
app.post('/register', upload.single('profilePicture'), (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    if (accounts.find(account => account.email === email)) {
        return res.status(400).json({ message: 'Email already registered.' });
    }

    const token = uuid.v4();
    const profilePic = req.file ? `/uploads/${req.file.filename}` : '/default-profile.png';

    // Store the password in plaintext as requested
    const newAccount = {
        firstName,
        lastName,
        email,
        password, // Plaintext password
        verified: false,
        token,
        profilePic
    };

    // Add the account to the accounts array and write it to the file
    accounts.push(newAccount);
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));

    // Store the verification token
    verificationTokens[token] = email;
    fs.writeFileSync(verificationFile, JSON.stringify(verificationTokens, null, 2));

    sendVerificationEmail(email, token);
    console.log(`Registration successful for email: ${email}`);
    res.status(200).json({ message: 'Registration successful! Please verify your email.' });
});

// Email verification endpoint
app.get('/verify/:token', (req, res) => {
    const { token } = req.params;
    const email = verificationTokens[token];

    if (!email) {
        return res.status(400).json({ message: 'Invalid verification token.' });
    }

    const account = accounts.find(acc => acc.email === email);
    if (account) {
        account.verified = true;
        fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
        delete verificationTokens[token];
        fs.writeFileSync(verificationFile, JSON.stringify(verificationTokens, null, 2));

        console.log(`Email verified for: ${email}`);
        res.status(200).json({ message: 'Email successfully verified!' });
    } else {
        res.status(400).json({ message: 'Account not found.' });
    }
});

// User login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const account = accounts.find(acc => acc.email === email);

    if (!account) {
        return res.status(400).json({ message: 'Email not registered.' });
    }

    if (!account.verified) {
        return res.status(400).json({ message: 'Email not verified. Please check your inbox.' });
    }

    // Check plaintext password (since we're not using bcrypt now)
    if (account.password !== password) {
        return res.status(400).json({ message: 'Invalid credentials.' });
    }

    res.status(200).json({ message: 'Login successful!' });
});

app.listen(port, () => {
    console.log(`Server running on ${host}`);
});
