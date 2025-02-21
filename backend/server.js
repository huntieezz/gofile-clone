const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const app = express();
const port = 5001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
const accounts = JSON.parse(fs.readFileSync(accountsFile));
const verificationTokens = JSON.parse(fs.readFileSync(verificationFile));

// Email transport setup
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gofileclone@gmail.com', // Replace with your email
        pass: 'Boardslide!1' // Replace with your email password or app password
    }
});

// Whitelist IP handling
app.post('/whitelist', (req, res) => {
    const { ip } = req.body;
    if (!ip) {
        return res.status(400).json({ message: 'IP is required.' });
    }

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

    // Save file info to show in the dashboard
    const downloadLink = `http://localhost:${port}/uploads/${req.file.filename}`;
    res.status(200).json({ downloadLink });
});

// Email verification sending
function sendVerificationEmail(email, token) {
    const verificationLink = `http://localhost:${port}/verify/${token}`;

    const mailOptions = {
        from: 'youremail@gmail.com',
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

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error encrypting password.' });
        }

        const token = uuid.v4(); // Generate a unique verification token
        const profilePic = req.file ? `/uploads/${req.file.filename}` : '/default-profile.png';

        // Log registration attempt
        console.log(`Attempting registration for: ${email}`);

        accounts.push({
            firstName, lastName, email, password: hashedPassword, verified: false, token, profilePic
        });
        fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));  // Save to accounts.json
        fs.writeFileSync(verificationFile, JSON.stringify({ ...verificationTokens, [token]: email }, null, 2));  // Save verification token

        // Send email verification
        sendVerificationEmail(email, token);
        console.log(`Registration successful for email: ${email}`);
        res.status(200).json({ message: 'Registration successful! Please verify your email.' });
    });
});

// Email verification endpoint
app.get('/verify/:token', (req, res) => {
    const { token } = req.params;
    const email = verificationTokens[token];

    if (!email) {
        return res.status(400).json({ message: 'Invalid verification token.' });
    }

    const account = accounts.find(acc => acc.email === email);
    account.verified = true;
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));  // Update the account's verified status
    delete verificationTokens[token];
    fs.writeFileSync(verificationFile, JSON.stringify(verificationTokens, null, 2));

    console.log(`Email verified for: ${email}`);
    res.status(200).json({ message: 'Email successfully verified!' });
});

// User login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const account = accounts.find(acc => acc.email === email);
    if (!account) {
        return res.status(400).json({ message: 'Email not registered.' });
    }

    bcrypt.compare(password, account.password, (err, isMatch) => {
        if (err || !isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        res.status(200).json({ message: 'Login successful!' });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
