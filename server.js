const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors());

// ✅ MongoDB connection
mongoose.connect('mongodb://localhost:27017/smartcity')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema
const applicationSchema = new mongoose.Schema({
  title: String,
  name: String,
  nric: String,
  dob: String,
  sex: String,
  phone: String,
  address: String,
  vacancySource: String,
  isPR: String,
  prDate: String,
  nationality: String,
  maritalStatus: String,
  passportNo: String,
  passportIssueDate: String,
  passportExpiryDate: String,
  passportIssuedPlace: String,
  workExperience: [
    { jobTitle: String, company: String, location: String, fromDate: String, toDate: String }
  ],
  education: [
    { school: String, fieldOfStudy: String, degree: String }
  ],
  languages: Object,
  position: String,
  submittedAt: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'services@smartcitytechnologies.com.sg',
    pass: 'YOUR_EMAIL_PASSWORD'
  }
});

// Generate PDF with logo
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Logo
    doc.image('logo.png', 50, 15, { width: 80 });
    doc.fontSize(20).text('Smart City Technologies Pte Ltd', 150, 30);
    doc.moveDown(2);

    // Personal Details
    doc.fontSize(16).text('Personal Details', { underline: true });
    doc.fontSize(12).text(`Title: ${data.title}`);
    doc.text(`Full Name: ${data.name}`);
    doc.text(`NRIC / FIN: ${data.nric}`);
    doc.text(`Date of Birth: ${data.dob}`);
    doc.text(`Sex: ${data.sex}`);
    doc.text(`Phone: ${data.phone}`);
    doc.text(`Postal Address: ${data.address}`);
    doc.text(`Vacancy Source: ${data.vacancySource}`);
    doc.moveDown();

    // Residency
    doc.fontSize(16).text('Residency', { underline: true });
    doc.fontSize(12).text(`Singapore PR: ${data.isPR}`);
    if (data.prDate) doc.text(`Date PR Issued: ${data.prDate}`);
    doc.text(`Nationality: ${data.nationality}`);
    doc.text(`Marital Status: ${data.maritalStatus}`);
    doc.moveDown();

    // Passport
    doc.fontSize(16).text('Passport Information', { underline: true });
    doc.fontSize(12).text(`Passport No: ${data.passportNo}`);
    doc.text(`Date of Issue: ${data.passportIssueDate}`);
    doc.text(`Date of Expiry: ${data.passportExpiryDate}`);
    doc.text(`Issued Place: ${data.passportIssuedPlace}`);
    doc.moveDown();

    // Work Experience
    doc.fontSize(16).text('Work Experience', { underline: true });
    data.workExperience.forEach((exp, i) => {
      doc.fontSize(12).text(`Experience ${i + 1}`);
      doc.text(`Job Title: ${exp.jobTitle}`);
      doc.text(`Company: ${exp.company}`);
      doc.text(`Location: ${exp.location}`);
      doc.text(`From: ${exp.fromDate}`);
      doc.text(`To: ${exp.toDate}`);
      doc.moveDown();
    });

    // Education
    doc.fontSize(16).text('Educational Background', { underline: true });
    data.education.forEach((edu, i) => {
      doc.fontSize(12).text(`Education ${i + 1}`);
      doc.text(`School / University: ${edu.school}`);
      doc.text(`Field of Study: ${edu.fieldOfStudy}`);
      doc.text(`Degree: ${edu.degree}`);
      doc.moveDown();
    });

    // Languages
    doc.fontSize(16).text('Languages', { underline: true });
    doc.fontSize(12).text(`English: ${data.languages.english}`);
    doc.text(`Chinese: ${data.languages.chinese}`);
    doc.text(`Mandarin: ${data.languages.mandarin}`);
    doc.text(`Malay: ${data.languages.malay}`);
    doc.text(`Tamil: ${data.languages.tamil}`);
    doc.moveDown();

    // Position
    doc.fontSize(16).text('Position Applied', { underline: true });
    doc.fontSize(12).text(`Position: ${data.position}`);
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('All Rights Reserved @ Smart City Technologies Pte Ltd *2026*', { align: 'center' });

    doc.end();
  });
}

// Candidate submission
app.post('/apply', async (req, res) => {
  try {
    const data = req.body;
    const application = new Application(data);
    await application.save();

    const pdfBuffer = await generatePDF(data);

    // Candidate acknowledgment
    await transporter.sendMail({
      from: 'services@smartcitytechnologies.com.sg',
      to: data.email,
      subject: 'Thank you for applying at Smart City Technologies',
      text: `Dear ${data.name},\n\nThank you for submitting your application for the ${data.position} role.\nOur HR team will review your application and contact you if shortlisted.\n\nBest regards,\nSmart City Technologies Pte Ltd\nwww.smartcitytechnologies.com.sg`
    });

    // HR email with PDF
    await transporter.sendMail({
      from: 'services@smartcitytechnologies.com.sg',
      to: 'services@smartcitytechnologies.com.sg',
      subject: 'New Job Application Received',
      text: `A new candidate has applied for the ${data.position} role. Please find the attached PDF with their details.`,
      attachments: [{ filename: 'application.pdf', content: pdfBuffer }]
    });

    res.status(200).json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// HR routes
app.get('/applications', async (req, res) => {
  const apps = await Application.find().sort({ submittedAt: -1 });
  res.json(apps);
});

app.get('/applications/:id/pdf', async (req, res) => {
  const appData = await Application.findById(req.params.id);
  if (!appData) return res.status(404).send('Application not found');

  const pdfBuffer = await generatePDF(appData);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdfBuffer);
});

app.listen(3000, () => console.log('Server running on port 3000'));
