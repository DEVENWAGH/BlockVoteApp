"""Generate all figures for the Block Vote IEEE paper from measured data in ./data.

Run: python make_figures.py   (writes vector PDFs into ./figures)
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "figures"
OUT.mkdir(exist_ok=True)

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Times", "DejaVu Serif"],
    "font.size": 8,
    "axes.titlesize": 8,
    "axes.labelsize": 8,
    "legend.fontsize": 7,
    "xtick.labelsize": 7,
    "ytick.labelsize": 7,
    "pdf.fonttype": 42,
})

INK = "#1f2937"
BLUE = "#1d4ed8"
TEAL = "#0f766e"
AMBER = "#b45309"
GREY = "#6b7280"
FILL = {"client": "#dbeafe", "server": "#dcfce7", "ext": "#fef3c7", "chain": "#ede9fe"}


def save(fig, name):
    fig.savefig(OUT / f"{name}.pdf", bbox_inches="tight")
    fig.savefig(OUT / f"{name}.png", bbox_inches="tight", dpi=220)


def box(ax, x, y, w, h, text, kind, fs=7, bold=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.01,rounding_size=0.015",
                                linewidth=0.8, edgecolor=INK, facecolor=FILL[kind]))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", color=INK, wrap=True)


def arrow(ax, x1, y1, x2, y2, label="", color=INK, both=False, lx=0, ly=0, fs=6, bg=True):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="<|-|>" if both else "-|>", lw=0.8, color=color,
                                shrinkA=1, shrinkB=1, mutation_scale=7))
    if label:
        ax.text((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, fontsize=fs, color=color,
                ha="center", va="center", **({"backgroundcolor": "white"} if bg else {}))


def fig_architecture():
    fig, ax = plt.subplots(figsize=(7.16, 3.3))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.10, 0.97, "Clients", ha="center", fontsize=8, fontweight="bold", color=BLUE)
    box(ax, 0.01, 0.72, 0.18, 0.18, "Android app\n(Kotlin, Compose)\nCameraX + ML Kit\n240° surround scan", "client")
    box(ax, 0.01, 0.43, 0.18, 0.18, "Polling-station PC\n(web ballot, /station)\nadmin-activated\nHMAC cookie", "client")
    box(ax, 0.01, 0.14, 0.18, 0.18, "Admin & guardian\ndashboards\n(NextAuth / wallet\nsignatures)", "client")

    ax.text(0.47, 0.97, "Application tier (Next.js 15 on Vercel)", ha="center", fontsize=8,
            fontweight="bold", color=TEAL)
    ax.add_patch(FancyBboxPatch((0.27, 0.08), 0.40, 0.85, boxstyle="round,pad=0.005,rounding_size=0.02",
                                linewidth=0.8, edgecolor=TEAL, facecolor="none", linestyle="--"))
    box(ax, 0.29, 0.74, 0.17, 0.14, "Identity\nemail OTP (bcrypt)\nnullifier = keccak256\n(email : secret)", "server", fs=6.3)
    box(ax, 0.48, 0.74, 0.17, 0.14, "Liveness\nRekognition\nDetectFaces checks\n→ 10-min JWT", "server", fs=6.3)
    box(ax, 0.29, 0.53, 0.17, 0.15, "Vote rules\nvoting window 07–18 IST\n2 app votes\nstation vote = final", "server", fs=6.3)
    box(ax, 0.48, 0.53, 0.17, 0.15, "Vote ledger\natomic slot reserve\n/ release on\nrelay failure", "server", fs=6.3)
    box(ax, 0.29, 0.30, 0.36, 0.16, "Gasless relay (ethers v6)\nsingle signer · serialized queue · NonceManager\n4 retries with back-off · random 32-byte ballot salt", "server", fs=6.3)
    box(ax, 0.29, 0.11, 0.36, 0.13, "Guardian & internal auth\nEIP-191 signed actions (5-min TTL) · ADMIN_API_KEY\nfail-closed production env", "server", fs=6.3)

    ax.text(0.86, 0.97, "External services", ha="center", fontsize=8, fontweight="bold", color=AMBER)
    box(ax, 0.75, 0.76, 0.22, 0.13, "MongoDB Atlas\nvoters, elections, OTPs,\nrelay log (no ballots↔ids)", "ext", fs=6.3)
    box(ax, 0.75, 0.58, 0.22, 0.12, "AWS Rekognition\nDetectFaces (liveness)", "ext", fs=6.3)
    box(ax, 0.75, 0.43, 0.22, 0.10, "Resend e-mail\nOTP · invites · receipts", "ext", fs=6.3)
    box(ax, 0.75, 0.10, 0.22, 0.27, "Ethereum (Sepolia)\nVotingV3 UUPS proxy\n\n• registerVoterByRelay\n• castVoteRelayedV3\n• VoteCastPrivate(ballotHash)\n• 2-of-3 guardian upgrades", "chain", fs=6.3)

    arrow(ax, 0.19, 0.81, 0.29, 0.81, "HTTPS", both=True)
    arrow(ax, 0.19, 0.52, 0.29, 0.60, "HTTPS", both=True)
    arrow(ax, 0.19, 0.23, 0.29, 0.18, "signed", both=True)
    arrow(ax, 0.65, 0.81, 0.75, 0.82, both=True)
    arrow(ax, 0.65, 0.78, 0.75, 0.64, both=True)
    arrow(ax, 0.65, 0.40, 0.75, 0.47, both=True)
    arrow(ax, 0.65, 0.36, 0.75, 0.28, "JSON-RPC", both=True, ly=-0.045, bg=False)
    arrow(ax, 0.47, 0.53, 0.47, 0.46)
    save(fig, "fig_architecture")
    plt.close(fig)


def fig_layers():
    fig, ax = plt.subplots(figsize=(3.5, 4.1))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    rows = [
        ("1. User / Admin\nInterfaces", [
            "Voter App\n(Android, 240°\nsurround scan)",
            "Polling-Station\nKiosk (admin-\nactivated web)",
            "Admin & Guardian\n(web dashboards)"]),
        ("2. Application &\nAuthentication\n(Next.js, Vercel)", [
            "Registration\n(CSV roster,\ninvite link)",
            "E-mail OTP +\nFace Liveness\n(Rekognition)",
            "Ballot Rules\n(2 app votes,\nstation = final)"]),
        ("3. Blockchain &\nGovernance\n(Ethereum\nSepolia)", [
            "Gasless Relayer\n(serial queue,\npays all gas)",
            "VotingV3 UUPS\n(tally + salted\ncommitment)",
            "2-of-3 Guardians\n(upgrades, EIP-191\nsigned actions)"]),
        ("4. Storage &\nAudit", [
            "MongoDB, IPFS,\nImageKit (records,\nsnapshots, media)",
            "Public Audit\n(tx-hash receipt,\naudit route)",
            "Election Results\n(on-chain\ncounters)"]),
        ("5. Actors", [
            "Voters\n(invited\nelectorate)",
            "Administrators\n(election\nofficials)",
            "Guardians\n(3 wallet\nholders)"]),
    ]
    row_h, gap, top = 0.15, 0.035, 0.985
    bx = [0.25, 0.505, 0.76]
    bw, bh = 0.22, 0.11
    centers = {}
    for r, (label, items) in enumerate(rows):
        y0 = top - row_h - r * (row_h + gap)
        ax.add_patch(plt.Rectangle((0.005, y0), 0.99, row_h, facecolor="white", edgecolor=GREY, lw=0.6))
        ax.add_patch(plt.Rectangle((0.005, y0), 0.225, row_h, facecolor="#eef0f3", edgecolor="none"))
        ax.text(0.015, y0 + row_h / 2, label, ha="left", va="center", fontsize=5.4, fontweight="bold", color=INK)
        for c, text in enumerate(items):
            yb = y0 + (row_h - bh) / 2
            ax.add_patch(plt.Rectangle((bx[c], yb), bw, bh, facecolor="white", edgecolor=INK, lw=0.7))
            ax.text(bx[c] + bw / 2, yb + bh / 2, text, ha="center", va="center", fontsize=5.0, color=INK,
                    linespacing=1.15)
            centers[(r, c)] = (bx[c] + bw / 2, yb, yb + bh)

    def solid(x1, y1, x2, y2):
        arrow(ax, x1, y1, x2, y2)

    def dashed(x1, y1, x2, y2, both=False):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="<|-|>" if both else "-|>", lw=0.7, color=INK, linestyle=(0, (3, 2)),
                                    shrinkA=1, shrinkB=1, mutation_scale=6))

    def mid_y(r, c):
        x, lo, hi = centers[(r, c)]
        return (lo + hi) / 2

    # Layer 1 -> layer 2: interfaces merge into the application tier.
    bus = centers[(0, 0)][1] - 0.012
    for c in range(3):
        x, lo, _ = centers[(0, c)]
        ax.plot([x, x], [lo, bus], color=INK, lw=0.7)
    ax.plot([centers[(0, 0)][0], centers[(0, 2)][0]], [bus, bus], color=INK, lw=0.7)
    solid(centers[(0, 1)][0], bus, centers[(1, 1)][0], centers[(1, 1)][2])
    # Registration -> authentication -> ballot rules.
    solid(bx[0] + bw, mid_y(1, 0), bx[1], mid_y(1, 1))
    solid(bx[1] + bw, mid_y(1, 1), bx[2], mid_y(1, 2))
    # Ballot rules -> relayer (elbow through the inter-layer gap).
    x2, lo2, _ = centers[(1, 2)]
    x0, _, hi0 = centers[(2, 0)]
    elbow = lo2 - (lo2 - hi0) / 2
    ax.plot([x2, x2, x0], [lo2, elbow, elbow], color=INK, lw=0.7)
    solid(x0, elbow, x0, hi0)
    # Relayer -> contract; guardians govern the contract.
    solid(bx[0] + bw, mid_y(2, 0), bx[1], mid_y(2, 1))
    dashed(bx[2], mid_y(2, 2), bx[1] + bw, mid_y(2, 1))
    # Contract feeds audit and results; storage is linked to audit.
    dashed(centers[(2, 1)][0], centers[(2, 1)][1], centers[(3, 1)][0], centers[(3, 1)][2])
    dashed(bx[1] + bw, mid_y(3, 1), bx[2], mid_y(3, 2), both=True)
    dashed(bx[0] + bw, mid_y(3, 0), bx[1], mid_y(3, 1), both=True)
    # Actors verify the public audit.
    dashed(centers[(4, 1)][0], centers[(4, 1)][2], centers[(3, 1)][0], centers[(3, 1)][1])

    ly = 0.03
    ax.plot([0.12, 0.2], [ly + 0.012] * 2, color=INK, lw=0.7)
    ax.annotate("", xy=(0.2, ly + 0.012), xytext=(0.19, ly + 0.012),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=0.7, mutation_scale=6))
    ax.text(0.215, ly + 0.012, "Operational flow", fontsize=5.5, va="center", color=INK)
    ax.plot([0.52, 0.6], [ly + 0.012] * 2, color=INK, lw=0.7, linestyle=(0, (3, 2)))
    ax.annotate("", xy=(0.6, ly + 0.012), xytext=(0.59, ly + 0.012),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=0.7, mutation_scale=6))
    ax.text(0.615, ly + 0.012, "Governance / audit flow", fontsize=5.5, va="center", color=INK)
    save(fig, "fig_layers")
    plt.close(fig)


def fig_sequence():
    actors = ["Voter\n(app / station)", "API\n(Vercel)", "Rekognition", "E-mail", "Relay", "VotingV3\n(chain)"]
    xs = [0.07 + i * 0.172 for i in range(len(actors))]
    msgs = [
        (0, 1, "POST /api/biometric/verify (frame + 240° scan passed)"),
        (1, 2, "DetectFaces(ALL)"),
        (2, 1, "1 face, conf ≥ 90, bright ≥ 30, no glasses, eyes open"),
        (1, 0, "biometric JWT (10 min)"),
        (0, 1, "POST /api/auth/send-otp"),
        (1, 3, "6-digit OTP (bcrypt, 5 min)"),
        (0, 1, "POST /api/auth/verify-otp (OTP, candidate, JWT)"),
        (1, 1, "window + allowance check; reserve vote slot"),
        (1, 4, "relayCastVote(election, candidate, nullifier)"),
        (4, 5, "castVoteRelayedV3(…, salt)"),
        (5, 4, "VoteCastPrivate(ballotHash, isRevote)"),
        (4, 1, "tx hash"),
        (1, 0, "receipt (tx hash, no candidate)"),
    ]
    fig, ax = plt.subplots(figsize=(7.16, 3.6))
    ax.set_xlim(0, 1)
    top, step = 0.90, 0.064
    bottom = top - step * (len(msgs) + 0.6)
    ax.set_ylim(bottom - 0.02, 1.0)
    ax.axis("off")
    for x, name in zip(xs, actors):
        ax.add_patch(FancyBboxPatch((x - 0.06, top + 0.015), 0.12, 0.075,
                                    boxstyle="round,pad=0.005,rounding_size=0.01",
                                    linewidth=0.8, edgecolor=INK, facecolor=FILL["client"]))
        ax.text(x, top + 0.052, name, ha="center", va="center", fontsize=6.5, color=INK)
        ax.plot([x, x], [top + 0.012, bottom], color=GREY, lw=0.6, ls=(0, (3, 2)))
    for i, (a, b, text) in enumerate(msgs):
        y = top - step * (i + 0.6)
        color = BLUE if a < b else TEAL
        if a == b:
            ax.annotate("", xy=(xs[a] + 0.004, y - 0.022), xytext=(xs[a] + 0.004, y + 0.008),
                        arrowprops=dict(arrowstyle="-|>", lw=0.7, color=AMBER,
                                        connectionstyle="arc3,rad=-1.4", mutation_scale=6))
            ax.text(xs[a] + 0.035, y - 0.007, text, fontsize=6, color=AMBER, va="center")
            continue
        ax.annotate("", xy=(xs[b], y), xytext=(xs[a], y),
                    arrowprops=dict(arrowstyle="-|>", lw=0.8, color=color, mutation_scale=7))
        ax.text((xs[a] + xs[b]) / 2, y + 0.019, text, fontsize=6, color=color, ha="center",
                va="center")
    save(fig, "fig_sequence")
    plt.close(fig)


def fig_channels():
    fig, ax = plt.subplots(figsize=(3.5, 1.9))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    states = {
        "S0": (0.02, 0.62, "Not voted"),
        "A1": (0.36, 0.62, "App vote 1\n(counts)"),
        "A2": (0.70, 0.62, "App vote 2\n(latest counts;\napp locked)"),
        "SF": (0.36, 0.08, "Station vote\nFINAL\n(overrides app)"),
    }
    w, h = 0.27, 0.27
    for key, (x, y, text) in states.items():
        kind = "chain" if key == "SF" else "client"
        box(ax, x, y, w, h, text, kind, fs=6.5, bold=key == "SF")
    arrow(ax, 0.29, 0.755, 0.36, 0.755, "app", fs=6, ly=0.17, bg=False)
    arrow(ax, 0.63, 0.755, 0.70, 0.755, "app", fs=6, ly=0.17, bg=False)
    arrow(ax, 0.155, 0.62, 0.40, 0.35, "station", color=TEAL, fs=6, lx=-0.05)
    arrow(ax, 0.495, 0.62, 0.495, 0.35, "station", color=TEAL, fs=6, lx=0.06)
    arrow(ax, 0.835, 0.62, 0.59, 0.35, "station", color=TEAL, fs=6, lx=0.05)
    ax.text(0.83, 0.20, "any further vote\n→ STATION_VOTE_FINAL", fontsize=5.8, color=AMBER, ha="center")
    ax.text(0.835, 0.95, "3rd app vote →\nVOTE_LIMIT_REACHED", fontsize=5.8, color=AMBER, ha="center")
    save(fig, "fig_channels")
    plt.close(fig)


def fig_gas():
    hh = json.loads((DATA / "hardhat_gas_benchmark.json").read_text())
    sep = json.loads((DATA / "sepolia_relay_transactions_stats.json").read_text())
    ops = [
        ("Create\nelection", hh["createElection"], sep["create_election"]["gas_mean"]),
        ("Add\ncandidate", hh["addCandidate"]["mean"], sep["add_candidate"]["gas_mean"]),
        ("Register\nvoter", hh["registerVoter"]["mean"], sep["register_voter"]["gas_mean"]),
        ("Phase\nchange", hh["transitionToVoting"], sep["transition_phase"]["gas_mean"]),
        ("First\nvote", hh["firstVote"]["mean"], None),
        ("Re-vote\n(changed)", hh["revoteChangedCandidate"]["mean"], None),
        ("Re-vote\n(same)", hh["revoteSameCandidate"]["mean"], None),
    ]
    fig, ax = plt.subplots(figsize=(3.5, 2.1))
    idx = range(len(ops))
    bw = 0.38
    ax.bar([i - bw / 2 for i in idx], [o[1] / 1000 for o in ops], bw, label="Hardhat benchmark (mean)",
           color=BLUE)
    ax.bar([i + bw / 2 for i in idx], [(o[2] or 0) / 1000 for o in ops], bw,
           label="Sepolia, live relay log (mean)", color=AMBER)
    for i, o in enumerate(ops):
        ax.text(i - bw / 2, o[1] / 1000 + 4, f"{o[1] / 1000:.1f}", ha="center", fontsize=5.5, rotation=90,
                va="bottom")
    ax.set_xticks(list(idx))
    ax.set_xticklabels([o[0] for o in ops])
    ax.set_ylabel("Gas used (×10³)")
    ax.set_ylim(0, 290)
    ax.grid(axis="y", lw=0.3, alpha=0.6)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper right")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    save(fig, "fig_gas")
    plt.close(fig)


def fig_latency():
    lat = json.loads((DATA / "live_latency.json").read_text())["endpoints"]
    names = [e["name"].replace("GET ", "") for e in lat]
    fig, ax = plt.subplots(figsize=(3.5, 1.9))
    y = range(len(lat))
    ax.barh([i + 0.18 for i in y], [e["p50"] for e in lat], 0.36, color=TEAL, label="p50")
    ax.barh([i - 0.18 for i in y], [e["p95"] for e in lat], 0.36, color="#99f6e4", label="p95",
            edgecolor=TEAL, linewidth=0.5)
    for i, e in enumerate(lat):
        ax.text(e["p50"] + 60, i + 0.18, f'{e["p50"]}', va="center", fontsize=5.8)
        ax.text(e["p95"] + 60, i - 0.18, f'{e["p95"]}', va="center", fontsize=5.8)
    ax.set_yticks(list(y))
    ax.set_yticklabels(names)
    ax.set_xlabel("Round-trip latency (ms), n = 20 per endpoint")
    ax.set_xlim(0, 5800)
    ax.grid(axis="x", lw=0.3, alpha=0.6)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="lower right")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    save(fig, "fig_latency")
    plt.close(fig)


def fig_cost():
    hh = json.loads((DATA / "hardhat_gas_benchmark.json").read_text())
    per_voter = hh["registerVoter"]["mean"] + hh["firstVote"]["mean"]
    per_voter_worst = per_voter + hh["revoteChangedCandidate"]["mean"]
    voters = [100, 1_000, 10_000, 100_000, 1_000_000]
    fig, ax = plt.subplots(figsize=(3.5, 2.0))
    for gwei, color in ((1, TEAL), (5, BLUE), (20, AMBER)):
        ax.plot(voters, [v * per_voter * gwei / 1e9 for v in voters], marker="o", ms=2.5, lw=1,
                color=color, label=f"{gwei} gwei, register + 1 vote")
        ax.plot(voters, [v * per_voter_worst * gwei / 1e9 for v in voters], lw=0.8, ls="--", color=color)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Registered voters")
    ax.set_ylabel("Relay gas cost (ETH)")
    ax.grid(which="major", lw=0.3, alpha=0.6)
    ax.legend(frameon=False, loc="upper left")
    ax.text(1.3e5, 2e-2, "dashed: + one changed re-vote", fontsize=5.8, color=GREY)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    save(fig, "fig_cost")
    plt.close(fig)


if __name__ == "__main__":
    fig_architecture()
    fig_layers()
    fig_sequence()
    fig_channels()
    fig_gas()
    fig_latency()
    fig_cost()
    print("figures written to", OUT)
