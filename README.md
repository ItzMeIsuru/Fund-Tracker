# 💰 Fund Tracker - Professional Student Finance Management

Fund Tracker is a premium, state-of-the-art personal finance management tool designed specifically for students. Built with a focus on professional aesthetics and advanced data reporting, it helps you track every rupee, dollar, or euro with precision and style.

## ✨ Features

### 🌌 Elite Dark Mode
- **True Black (#000000)**: A stunning, high-contrast dark theme designed for modern OLED displays and professional focus.
- **Cyan Accents**: Modern cyan highlights for a futuristic, premium feel.
- **No Distractions**: Clean, minimal UI with zero clutter.

### 📊 Smart Transaction Management
- **3-Day Window Pagination**: Automatically organizes your recent transactions into manageable 3-day chunks.
- **Intelligent Sorting**: Transactions are sorted by time, keeping your latest spending at the top.
- **Category Tracking**: Detailed categorization for expenses with professional icons.

### 📄 Advanced PDF Reporting
- **Automated Pagination**: Export your data into professional PDF reports where transactions are automatically grouped onto separate pages by their date windows.
- **Custom Branding**: Clean, branded headers with user details and generation timestamps.
- **Sanitized Exports**: Reliable downloads with clean filenames and `.pdf` extensions.

### 💱 Real-time Financial Tools
- **Live Currency Conversion**: Supports **LKR, USD, INR, and EUR** with real-time exchange rates.
- **Budget Monitoring**: Set daily or monthly limits and get visual overspend alerts.
- **Savings Goals**: Track your progress towards savings targets with dynamic progress bars.
- **Interactive Analytics**: Powered by **Chart.js**, offering deep insights into your spending habits via Pie and Bar charts.

### ☁️ Seamless Sync
- **NeonDB Integration**: Real-time cloud synchronization ensures your data is safe across sessions.
- **LocalStorage Fallback**: Reliable offline experience with automatic local persistence.

## 🚀 Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Advanced Glassmorphism), JavaScript (ES6+).
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- **Database**: [NeonDB](https://neon.tech/) (PostgreSQL) via Netlify Functions.
- **Icons**: [FontAwesome 6](https://fontawesome.com/)

## 🛠️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ItzMeIsuru/Fund-Tracker.git
   cd Fund-Tracker
   ```

2. **Run Locally**:
   Simply open `index.html` in any modern web browser. For the best experience (avoiding CORS issues with external APIs), use a simple local server:
   ```bash
   npx http-server ./
   ```

3. **Backend Sync (Optional)**:
   The app is pre-configured to sync with a NeonDB backend via Netlify. Ensure your environment variables are set up in your Netlify dashboard if deploying.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
**Developed with ❤️ by [Isuru Lakruwan](https://github.com/ItzMeIsuru)**
