import React, { useState } from "react";
import Intake from "./pages/Intake.jsx";
import StaffBoard from "./pages/StaffBoard.jsx";

export default function App() {
  const [tab, setTab] = useState("intake");
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">+</div>
          <div>
            <h1>NexusCare</h1>
            <p>Care, coordinated.</p>
          </div>
        </div>
        <nav>
          <button className={tab === "intake" ? "tab active" : "tab"} onClick={() => setTab("intake")}>
            Patient Intake
          </button>
          <button className={tab === "staff" ? "tab active" : "tab"} onClick={() => setTab("staff")}>
            Staff Board
          </button>
        </nav>
      </header>
      <main>{tab === "intake" ? <Intake onSaved={() => {}} /> : <StaffBoard />}</main>
      <footer>CSB312 · Generative AI · Mini Project 2 — AI assists intake; staff always confirm.</footer>
    </div>
  );
}
