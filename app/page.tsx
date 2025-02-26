"use client";

import React from "react";
import styles from "./page.module.css";

const Home = () => {
  const categories = {
    "GO": "basic-chat",
    // "GO": "function-calling",
    // "File search": "file-search",
    // All: "all",
  };

  return (
    <main className={styles.main}>
      <div className={styles.title}>
       Toutes les informations sur le Festival Classiquicime Megève 2025
      </div>
      <div className={styles.container}>
        {Object.entries(categories).map(([name, url]) => (
          <a key={name} className={styles.category} href={`/examples/${url}`}>
            {name}
          </a>
        ))}
      </div>
    </main>
  );
};

export default Home;
