# Smart Search Automator  

![Smart Search Automator](./8dddfb20-3740-48d0-9d84-ce43a93920c5.png)

## 🚀 Overview  
**Smart Search Automator** is a free Chrome extension that automates **Microsoft Bing Rewards searches** using **AI-powered queries from Gemini**.  
It helps you maximize Bing Rewards points effortlessly by running smart/random searches, scheduling daily runs, and even customizing the popup with **5 themes**.  

---

## ✨ Features  
- 🔍 **Bing Rewards Automation** – Automatically runs searches so you don’t have to.  
- 🤖 **Gemini AI Integration** – Uses AI to generate realistic and varied search queries.  
- 📅 **Scheduling Support** – Set it to run searches at specific times daily.  
- 🎨 **5 UI Themes** – Choose from multiple color themes for the popup.  
- 🖱️ **One-Click Usage** – Simple popup to start or schedule.  
- 🌍 **Open Source & Free** – Anyone can use and contribute.  

---

## 🛠 Installation Guide (Chrome)  

1. **Download the Extension**  
   - Click the green **Code** button on this repo → `Download ZIP`.  
   - Extract the downloaded ZIP file to a folder.  

2. **Open Chrome Extensions**  
   - Open Google Chrome.  
   - In the address bar, type:  
     ```
     chrome://extensions/
     ```  

3. **Enable Developer Mode**  
   - Toggle **Developer mode** (top-right corner).  

4. **Load the Extension**  
   - Click **Load unpacked**.  
   - Select the extracted folder.  

5. **Done 🎉**  
   - The extension will now appear in your extensions toolbar.  

---

## 🔑 Setting up Gemini API Key  

This extension uses **Gemini AI** to generate search queries. You need an API key:  

1. Go to [Google AI Studio](https://aistudio.google.com/).  
2. Sign in with your Google account.  
3. In the sidebar, click **API Keys**.  
4. Click **Create API Key**.  
5. Copy the generated key.  
6. Open the project folder → find `background.js`.  
7. Replace the placeholder line:  
   ```javascript
   const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
