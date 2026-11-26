# Rakhsa Hospital Appointment Booking

A responsive hospital appointment booking website with a lightweight Node.js backend. No third-party runtime dependencies are required.

## Run locally

Requires Node.js 18 or later.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Appointments are stored in `data/appointments.json`; the data directory is created on the first successful booking. Set `PORT` to change the listening port.

## Features

- Responsive landing page with specialties, doctor profiles, and booking instructions.
- Filter doctors by specialty and select an appointment date.
- Live availability checks and protection against duplicate bookings.
- Server-side validation and persistent appointment storage.
- Confirmation with appointment details and booking reference.
- JSON API: `GET /api/doctors`, `GET /api/slots?doctorId=…&date=YYYY-MM-DD`, `POST /api/appointments`, and `GET /api/health`.

## Notes

Doctor profiles and fees are sample content in `server.js`; update them for the intended hospital. The JSON file store is suitable for a small demo or single-process deployment. A production deployment should use a managed database and configure HTTPS, backups, and access controls appropriate to the hospital.
