const repositories = [
  { name: "devora / platform", detail: "The open developer universe", language: "TypeScript", color: "#3178c6", stars: 128, updated: "Updated 2 hours ago" },
  { name: "devora / forge-core", detail: "Git hosting and collaboration engine", language: "Go", color: "#00add8", stars: 84, updated: "Updated yesterday" },
  { name: "devora / ai-lab", detail: "AI tools for software teams", language: "Python", color: "#3572a5", stars: 56, updated: "Updated 3 days ago" }
];

const nav = ["Overview", "Repositories", "Projects", "Issues", "Pull requests", "Discussions", "Marketplace"];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">D</span><span>DEVORA<small>THE DEVELOPER UNIVERSE</small></span></a>
        <button className="workspace">⌘ &nbsp; Personal workspace <span>⌄</span></button>
        <div className="nav-label">WORKSPACE</div>
        <nav>{nav.map((item, i) => <a className={i === 0 ? "nav-item active" : "nav-item"} href="#" key={item}><span className="nav-icon">{["◫","▤","▦","◎","⑂","◌","✧"][i]}</span>{item}{item === "Issues" && <span className="nav-count">4</span>}</a>)}</nav>
        <div className="sidebar-bottom"><div className="avatar">D</div><div><b>DEVORA Workspace</b><small>Free plan · Preview</small></div><span className="dots">···</span></div>
      </aside>
      <section className="content">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> Overview</div><div className="top-actions"><button className="icon-btn" aria-label="Notifications">♧</button><button className="icon-btn" aria-label="Help">?</button><div className="profile">D</div></div></header>
        <div className="page-wrap">
          <section className="welcome"><div><div className="eyebrow"><span className="live-dot"/> YOUR DEVELOPMENT WORKSPACE</div><h1>Build something<br/><em>extraordinary.</em></h1><p>Everything your team needs to plan, build, review, and ship better software — in one universe.</p><div className="welcome-actions"><a className="primary-btn" href="#repositories">Explore repositories <span>→</span></a><a className="text-btn" href="#features">Discover DEVORA</a></div></div><div className="orb-wrap"><div className="orb"><div className="orb-core">D</div><i className="orbit orbit-one"/><i className="orbit orbit-two"/><i className="orbit orbit-three"/></div><div className="orb-caption">ONE UNIVERSE. INFINITE BUILDS.</div></div></section>
          <section className="stats"><div><span>Repositories</span><strong>03</strong><small>Ready to grow</small></div><div><span>Contributors</span><strong>12</strong><small>Building together</small></div><div><span>Open issues</span><strong>04</strong><small>Across workspace</small></div><div><span>Deployments</span><strong>08</strong><small>Last 30 days</small></div></section>
          <section className="section" id="repositories"><div className="section-heading"><div><div className="eyebrow">YOUR CODE, YOUR UNIVERSE</div><h2>Recent repositories</h2></div><a href="#" className="subtle-link">View all repositories →</a></div><div className="repo-grid">{repositories.map(repo => <article className="repo-card" key={repo.name}><div className="repo-top"><span className="repo-symbol">⌘</span><span className="visibility">PUBLIC</span></div><h3>{repo.name}</h3><p>{repo.detail}</p><div className="repo-meta"><span><i style={{background:repo.color}}/> {repo.language}</span><span>☆ {repo.stars}</span></div><small className="updated">{repo.updated}</small></article>)}</div></section>
          <section className="section feature-section" id="features"><div className="section-heading"><div><div className="eyebrow">MORE THAN CODE HOSTING</div><h2>Made for the way you build.</h2></div></div><div className="feature-grid"><article><b>⌘</b><h3>Code collaboration</h3><p>Repositories, branches, reviews, and team workflows designed to move projects forward.</p></article><article><b>✧</b><h3>AI-native development</h3><p>Bring intelligent code assistance, project understanding, and automated reviews into your workflow.</p></article><article><b>↗</b><h3>Ship with confidence</h3><p>Plan work, automate builds, track releases, and connect your deployment pipeline.</p></article></div></section>
          <footer><span>© 2026 DEVORA</span><span>Build. Collaborate. Create.</span><span>Developer preview · Core services are being connected</span></footer>
        </div>
      </section>
    </main>
  );
}
