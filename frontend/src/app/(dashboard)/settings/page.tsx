"use client";

import { useState } from "react";
import { SettingsProfile } from "./components/SettingsProfile";
import { SettingsSourceChannels } from "./components/SettingsSourceChannels";

type Tab = "profile" | "source-channels";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "profile", label: "Profile", icon: "person" },
  { id: "source-channels", label: "Source Channels", icon: "star" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-headline-sm text-on-surface font-semibold">Settings</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Kelola profil dan pengaturan sistem
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-outline-variant mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline"
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <SettingsProfile />}
      {activeTab === "source-channels" && <SettingsSourceChannels />}
    </div>
  );
}
