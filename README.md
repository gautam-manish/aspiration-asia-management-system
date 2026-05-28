# Aspiration AISA — Travel Management System

Full-stack travel agency management — React + Node.js + Express + MongoDB.

## New in this version

| Module            | Description                                              |
|-------------------|----------------------------------------------------------|
| 🏢 Sundry         | Debtors & Creditors directory with edit detail page      |
| 📈 Sales Records  | Invoice payment tracking with payment entries            |
| 📒 Purchase Records | Full debtor ledger with DR/CR transactions & PDF export |
| 📦 Package Cost   | Tour package builder with email quote sending            |

## Project Structure

```
aspiration-aisa/
├── backend/
│   ├── config/          db.js
│   ├── controllers/     15 controllers
│   ├── middleware/       auth.middleware.js
│   ├── models/          12 Mongoose schemas
│   ├── routes/          13 route files
│   └── app.js
└── frontend/
    └── src/
        ├── api/          All Axios API calls
        ├── components/   Layout (grouped sidebar) + common UI
        ├── pages/        20 pages across all modules
        └── utils/        helpers.js
```

## Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev            # runs on port 5000

# Frontend
cd frontend
npm install
npm run dev            # runs on port 3000
```

## .env values required

```
MONGO_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD=your_admin_password
```
