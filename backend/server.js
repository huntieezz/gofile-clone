const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const port = 5001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Whitelist IP file
const whitelistFile = path.join(__dirname, 'whitelisted.json');
if (!fs.existsSync(whitelistFile)) fs.writeFileSync(whitelistFile, '[]');

const whitelist = JSON.parse(fs.readFileSync(whitelistFile));

// Server and file upload handling
app.post('/upload', (req, res) => {
    const ip = req.ip;
    if (!whitelist.includes(ip)) {
        return res.status(403).json({ message: 'Your IP is not whitelisted.' });
    }
    
    // Handle file upload logic
    // Your file handling logic here...

    res.json({ downloadLink: 'https://your-link.com/download' });
});

// Admin whitelist handling
app.post('/whitelist', (req, res) => {
    const { ip } = req.body;
    if (whitelist.includes(ip)) {
        return res.json({ message: 'IP already whitelisted.' });
    }

    whitelist.push(ip);
    fs.writeFileSync(whitelistFile, JSON.stringify(whitelist, null, 2));
    res.json({ message: `IP ${ip} has been whitelisted.` });
});

// Email sending setup
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'youremail@gmail.com',
        pass: 'yourpassword'
    }
});

// Email verification function
function sendVerificationEmail(email, verificationLink) {
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

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
