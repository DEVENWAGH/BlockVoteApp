# -*- coding: utf-8 -*-
"""
Data and HTML builders for BlockVote Master Viva Guide & Paper Analysis
"""

CSS_STYLES = """
@page {
  size: A4;
  margin: 18mm 16mm 18mm 16mm;
  @bottom-right {
    content: "Page " counter(page);
  }
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  line-height: 1.55;
  font-size: 12.5px;
  background: #ffffff;
  margin: 0;
  padding: 0;
}
h1, h2, h3, h4 {
  color: #0f172a;
  font-weight: 700;
}
h1 {
  font-size: 22px;
  border-bottom: 2px solid #2563eb;
  padding-bottom: 6px;
  margin-top: 0;
  margin-bottom: 12px;
}
h2 {
  font-size: 16px;
  background: #f1f5f9;
  padding: 8px 12px;
  border-left: 5px solid #2563eb;
  margin-top: 24px;
  margin-bottom: 12px;
  page-break-after: avoid;
}
h3 {
  font-size: 14px;
  color: #1e40af;
  margin-top: 16px;
  margin-bottom: 6px;
  page-break-after: avoid;
}
h4 {
  font-size: 12.5px;
  color: #334155;
  margin-top: 10px;
  margin-bottom: 4px;
}
p {
  margin: 5px 0;
}
ul, ol {
  margin: 5px 0 8px 18px;
  padding: 0;
}
li {
  margin-bottom: 3px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 11px;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 5px 7px;
  text-align: left;
  vertical-align: top;
}
th {
  background-color: #f8fafc;
  color: #0f172a;
  font-weight: 600;
}
tr:nth-child(even) {
  background-color: #fbfcfd;
}
code {
  font-family: Consolas, 'Courier New', monospace;
  background-color: #f1f5f9;
  padding: 1px 3px;
  border-radius: 3px;
  font-size: 11px;
  color: #0f172a;
}
pre {
  background-color: #0f172a;
  color: #f8fafc;
  padding: 8px 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 10.5px;
  line-height: 1.4;
  page-break-inside: avoid;
}
pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}
.q-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #3b82f6;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 12px;
  page-break-inside: avoid;
}
.q-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e3a8a;
  margin-bottom: 6px;
}
.ans-tag {
  font-weight: 700;
  color: #047857;
}
.tech-tag {
  font-weight: 700;
  color: #b45309;
}
.why-tag {
  font-weight: 700;
  color: #6d28d9;
}
.code-tag {
  font-weight: 700;
  color: #be123c;
}
.badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  background: #e0e7ff;
  color: #3730a3;
}
.stat-grid {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 10px 0 16px 0;
}
.stat-card {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 4px;
  text-align: center;
}
.stat-val {
  font-size: 15px;
  font-weight: 700;
  color: #2563eb;
}
.stat-lbl {
  font-size: 9.5px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
}
.header-banner {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  color: #ffffff;
  padding: 14px 18px;
  border-radius: 6px;
  margin-bottom: 14px;
}
.header-banner h1 {
  color: #ffffff;
  border-bottom: none;
  margin: 0 0 4px 0;
  font-size: 18px;
}
.header-banner p {
  margin: 2px 0;
  font-size: 11.5px;
  color: #e0e7ff;
}
.page-break {
  page-break-before: always;
}
.callout {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 8px 0;
}
.callout-title {
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 3px;
}
"""
