const $ = (selector) => document.querySelector(selector);
const doctorGrid = $('#doctor-grid');
const specialtySelect = $('#specialty');
const doctorSelect = $('#doctor');
const dateInput = $('#date');
const slotsContainer = $('#slots');
const timeInput = $('#time');
const feeLabel = $('#fee');
const bookingForm = $('#booking-form');
const message = $('#form-message');
const successPanel = $('#success-panel');
let doctors = [];

const dateToday = new Date();
const localToday = new Date(dateToday.getTime() - dateToday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.min = localToday;

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

async function api(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function renderDoctors() {
  doctorGrid.innerHTML = doctors.map(doctor => `
    <article class="doctor-card">
      <div class="doctor-avatar avatar-${doctor.color}" aria-hidden="true"><span>${doctor.initials}</span></div>
      <div class="doctor-info"><span class="doctor-specialty">${doctor.specialty}</span><h3>${doctor.name}</h3><p>${doctor.bio}</p>
      <div class="doctor-meta"><span>${doctor.experience} experience</span><strong>₹${doctor.fee}</strong></div>
      <a href="#booking" class="doctor-book" data-doctor="${doctor.id}">Book a visit <span>↗</span></a></div>
    </article>`).join('');
  const specialties = [...new Set(doctors.map(doctor => doctor.specialty))];
  specialtySelect.innerHTML = '<option value="">Select specialty</option>' + specialties.map(s => `<option value="${s}">${s}</option>`).join('');
}

function updateDoctors(selectedSpecialty = '') {
  const available = doctors.filter(doctor => !selectedSpecialty || doctor.specialty === selectedSpecialty);
  doctorSelect.innerHTML = '<option value="">Select a doctor</option>' + available.map(doctor => `<option value="${doctor.id}">${doctor.name}</option>`).join('');
  doctorSelect.disabled = available.length === 0;
  doctorSelect.value = '';
  feeLabel.textContent = '—';
  clearSlots();
}

function clearSlots(text = 'Choose a doctor and date first') {
  timeInput.value = '';
  slotsContainer.innerHTML = `<span class="slot-prompt">${text}</span>`;
}

async function loadSlots() {
  const doctorId = doctorSelect.value;
  const date = dateInput.value;
  if (!doctorId || !date) return clearSlots();
  clearSlots('Checking available times…');
  try {
    const { slots } = await api(`/api/slots?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`);
    if (!slots.some(slot => slot.available)) return clearSlots('No times left. Please choose another date.');
    slotsContainer.innerHTML = slots.map(({ time, available }) => {
      const label = new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      return `<button class="slot-button" type="button" data-time="${time}" aria-pressed="false" ${available ? '' : 'disabled'}>${label}</button>`;
    }).join('');
  } catch (error) { clearSlots(error.message); }
}

specialtySelect.addEventListener('change', () => updateDoctors(specialtySelect.value));
doctorSelect.addEventListener('change', () => {
  const doctor = doctors.find(item => item.id === doctorSelect.value);
  feeLabel.textContent = doctor ? `₹${doctor.fee}` : '—';
  loadSlots();
});
dateInput.addEventListener('change', loadSlots);
slotsContainer.addEventListener('click', event => {
  const button = event.target.closest('[data-time]');
  if (!button || button.disabled) return;
  slotsContainer.querySelectorAll('[data-time]').forEach(slot => slot.setAttribute('aria-pressed', 'false'));
  button.setAttribute('aria-pressed', 'true');
  timeInput.value = button.dataset.time;
  message.textContent = '';
});
doctorGrid.addEventListener('click', event => {
  const link = event.target.closest('[data-doctor]');
  if (!link) return;
  const doctor = doctors.find(item => item.id === link.dataset.doctor);
  if (doctor) {
    specialtySelect.value = doctor.specialty;
    updateDoctors(doctor.specialty);
    doctorSelect.value = doctor.id;
    feeLabel.textContent = `₹${doctor.fee}`;
    loadSlots();
  }
});

bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = '';
  const submitButton = bookingForm.querySelector('[type=submit]');
  if (!timeInput.value) { message.textContent = 'Please choose one of the available appointment times.'; return; }
  const form = new FormData(bookingForm);
  const body = Object.fromEntries(form.entries());
  body.doctorId = doctorSelect.value;
  body.date = dateInput.value;
  body.time = timeInput.value;
  submitButton.disabled = true;
  submitButton.innerHTML = 'Booking your visit…';
  try {
    const { appointment } = await api('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    bookingForm.hidden = true;
    successPanel.hidden = false;
    successPanel.innerHTML = `<div class="success-icon">✓</div><h3>You’re all booked, ${escapeHtml(appointment.patientName.split(' ')[0])}.</h3><p>Your appointment is confirmed. We look forward to seeing you.</p><div class="success-details"><strong>${escapeHtml(appointment.doctorName)}</strong> · ${escapeHtml(appointment.specialty)}<br>${formatDate(appointment.date)} at ${new Date(`2000-01-01T${appointment.time}:00`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}<br>Consultation fee · ₹${appointment.fee}<br><span>Booking reference · ${escapeHtml(appointment.id.slice(0, 8).toUpperCase())}</span></div><button type="button" id="book-another">Book another appointment ↗</button>`;
    successPanel.querySelector('#book-another').addEventListener('click', () => {
      bookingForm.reset(); bookingForm.hidden = false; successPanel.hidden = true;
      doctorSelect.disabled = true; doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
      feeLabel.textContent = '—'; clearSlots(); message.textContent = '';
    });
  } catch (error) { message.textContent = error.message; }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Confirm appointment <span>↗</span>'; }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

document.querySelectorAll('.specialty-card').forEach(card => card.addEventListener('click', () => {
  specialtySelect.value = card.dataset.specialty;
  updateDoctors(card.dataset.specialty);
}));

const menuToggle = $('.menu-toggle');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  $('.main-nav').classList.toggle('open', open);
});
$('.main-nav').addEventListener('click', event => {
  if (event.target.closest('a')) { $('.main-nav').classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }
});

api('/api/doctors').then(result => { doctors = result.doctors; renderDoctors(); }).catch(error => {
  doctorGrid.innerHTML = `<div class="loading-card">${escapeHtml(error.message)} Please refresh the page.</div>`;
});
