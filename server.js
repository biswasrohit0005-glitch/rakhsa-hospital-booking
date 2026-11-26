const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'src');
const DATA_DIR = path.join(ROOT, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'appointments.json');
const PORT = Number(process.env.PORT) || 3000;

const doctors = [
  { id: 'ananya-rao', name: 'Dr. Ananya Rao', specialty: 'Cardiology', department: 'Heart & Vascular', experience: '12 years', fee: 900, initials: 'AR', color: 'lavender', bio: 'Known for thoughtful, preventive heart care and clear explanations.' },
  { id: 'kabir-mehta', name: 'Dr. Kabir Mehta', specialty: 'Neurology', department: 'Brain & Nerves', experience: '9 years', fee: 800, initials: 'KM', color: 'mint', bio: 'Helps patients manage headaches, sleep concerns, and neurological conditions.' },
  { id: 'sana-iyer', name: 'Dr. Sana Iyer', specialty: 'Pediatrics', department: 'Children’s Health', experience: '11 years', fee: 700, initials: 'SI', color: 'peach', bio: 'Warm, practical care for children from newborn visits through adolescence.' },
  { id: 'rohan-kulkarni', name: 'Dr. Rohan Kulkarni', specialty: 'Orthopedics', department: 'Bones & Joints', experience: '14 years', fee: 850, initials: 'RK', color: 'blue', bio: 'Focused on helping people return to movement with a clear care plan.' },
  { id: 'meera-nair', name: 'Dr. Meera Nair', specialty: 'Dermatology', department: 'Skin & Hair', experience: '8 years', fee: 750, initials: 'MN', color: 'rose', bio: 'Evidence-based care for skin, hair, and everyday dermatology concerns.' },
  { id: 'arjun-sen', name: 'Dr. Arjun Sen', specialty: 'General Medicine', department: 'Primary Care', experience: '10 years', fee: 500, initials: 'AS', color: 'sand', bio: 'Your first stop for checkups, common illnesses, and ongoing health support.' }
];

const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

function readBookings() {
  try { return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8')); }
  catch { return []; }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function serveFile(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const file = path.resolve(PUBLIC, `.${requested}`);
  if (!file.startsWith(`${PUBLIC}${path.sep}`)) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, content) => {
    if (err) return json(res, 404, { error: 'Not found' });
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/doctors') return json(res, 200, { doctors });
  if (req.method === 'GET' && url.pathname === '/api/slots') {
    const doctorId = url.searchParams.get('doctorId');
    const date = url.searchParams.get('date');
    if (!doctors.some(d => d.id === doctorId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json(res, 400, { error: 'Choose a doctor and a valid date.' });
    const booked = readBookings().filter(b => b.doctorId === doctorId && b.date === date).map(b => b.time);
    return json(res, 200, { slots: slots.map(time => ({ time, available: !booked.includes(time) })) });
  }
  if (req.method === 'POST' && url.pathname === '/api/appointments') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Please submit valid booking details.' }); }
    const { doctorId, date, time, patientName, email, phone, reason } = body;
    const doctor = doctors.find(d => d.id === doctorId);
    const dateObj = new Date(`${date}T00:00:00`);
    if (!doctor || !date || Number.isNaN(dateObj.getTime()) || date < new Date().toISOString().slice(0, 10)) return json(res, 400, { error: 'Choose a valid date and doctor.' });
    if (!slots.includes(time)) return json(res, 400, { error: 'Choose an available appointment time.' });
    if (typeof patientName !== 'string' || patientName.trim().length < 2 || patientName.length > 100) return json(res, 400, { error: 'Enter your full name.' });
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return json(res, 400, { error: 'Enter a valid email address.' });
    if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10 || phone.length > 30) return json(res, 400, { error: 'Enter a valid phone number.' });
    const bookings = readBookings();
    if (bookings.some(b => b.doctorId === doctorId && b.date === date && b.time === time)) return json(res, 409, { error: 'That time was just booked. Please choose another slot.' });
    const appointment = { id: randomUUID(), doctorId, doctorName: doctor.name, specialty: doctor.specialty, date, time, patientName: patientName.trim(), email: email.trim(), phone: phone.trim(), reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '', fee: doctor.fee, createdAt: new Date().toISOString() };
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      bookings.push(appointment);
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    } catch (err) { console.error('Could not save appointment:', err); return json(res, 500, { error: 'We could not save your booking. Please try again.' }); }
    return json(res, 201, { appointment: { id: appointment.id, doctorName: appointment.doctorName, specialty: appointment.specialty, date: appointment.date, time: appointment.time, patientName: appointment.patientName, fee: appointment.fee } });
  }
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok' });
  if (req.method === 'GET' || req.method === 'HEAD') return serveFile(req, res, url.pathname);
  return json(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => console.log(`Rakhsa is running at http://localhost:${PORT}`));
