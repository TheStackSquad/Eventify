// frontend/src/components/modal/analytics/shared/exportButton.js

import React, { useState } from "react";
import { FileText, Share2, Download, Check, Loader2 } from "lucide-react";

export default function ExportButton({ analytics, eventTitle }) {
  const [isExporting, setIsExporting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  /**
   * Generate PDF report from analytics data
   * Uses browser's print functionality for PDF generation
   */
  const handleExportPdf = async () => {
    if (!analytics || Object.keys(analytics).length === 0) {
      alert("No analytics data available to export");
      return;
    }

    setIsExporting(true);

    try {
      // Create a formatted HTML document for printing
      const printWindow = window.open("", "_blank");
      
      if (!printWindow) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      const { overview, revenue, tickets, orders, customers, payments } = analytics;

      // Generate HTML content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${eventTitle} - Analytics Report</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 40px;
              color: #1f2937;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #4f46e5;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #4f46e5;
              margin: 0 0 10px 0;
              font-size: 32px;
            }
            .header .subtitle {
              color: #6b7280;
              font-size: 14px;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 20px;
            }
            .metric-card {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #4f46e5;
            }
            .metric-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            .metric-value {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
            }
            .metric-subtext {
              font-size: 13px;
              color: #9ca3af;
              margin-top: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              text-align: left;
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              background-color: #f3f4f6;
              font-weight: 600;
              color: #374151;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${eventTitle}</h1>
            <div class="subtitle">Analytics Report | Generated ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
          </div>

          <!-- Overview Section -->
          ${overview ? `
          <div class="section">
            <div class="section-title">📊 Event Overview</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value">₦${(overview.totalRevenue / 100).toLocaleString()}</div>
                <div class="metric-subtext">${overview.totalOrders || 0} orders</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Tickets Sold</div>
                <div class="metric-value">${overview.ticketsSold || 0}</div>
                <div class="metric-subtext">${tickets?.sellThroughRate || 0}% sell-through</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Conversion Rate</div>
                <div class="metric-value">${overview.conversionRate || 0}%</div>
                <div class="metric-subtext">From ${overview.totalViews || 0} views</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Event Status</div>
                <div class="metric-value">${overview.status?.toUpperCase() || 'N/A'}</div>
                <div class="metric-subtext">${overview.daysUntilEvent ? `${overview.daysUntilEvent} days away` : 'Date TBD'}</div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Revenue Breakdown -->
          ${revenue ? `
          <div class="section">
            <div class="section-title">💰 Revenue Breakdown</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Gross Revenue</div>
                <div class="metric-value">₦${(revenue.gross / 100).toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Platform Fees</div>
                <div class="metric-value">₦${(revenue.platformFees / 100).toLocaleString()}</div>
                <div class="metric-subtext">${revenue.platformFeePercentage || 0}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Payment Fees</div>
                <div class="metric-value">₦${(revenue.paymentFees / 100).toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Net Revenue</div>
                <div class="metric-value">₦${(revenue.net / 100).toLocaleString()}</div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Ticket Tiers -->
          ${analytics.tiers && analytics.tiers.length > 0 ? `
          <div class="section">
            <div class="section-title">🎫 Ticket Tiers Performance</div>
            <table>
              <thead>
                <tr>
                  <th>Tier Name</th>
                  <th>Price</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                  <th>Revenue</th>
                  <th>Sell-Through</th>
                </tr>
              </thead>
              <tbody>
                ${analytics.tiers.map(tier => `
                  <tr>
                    <td>${tier.name}</td>
                    <td>₦${(tier.price / 100).toLocaleString()}</td>
                    <td>${tier.sold}</td>
                    <td>${tier.remaining}</td>
                    <td>₦${(tier.revenue / 100).toLocaleString()}</td>
                    <td>${tier.sellThroughRate}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Customer Insights -->
          ${customers ? `
          <div class="section">
            <div class="section-title">👥 Customer Insights</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Customers</div>
                <div class="metric-value">${customers.total || 0}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">New Customers</div>
                <div class="metric-value">${customers.new || 0}</div>
                <div class="metric-subtext">${customers.newPercentage || 0}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Returning</div>
                <div class="metric-value">${customers.returning || 0}</div>
                <div class="metric-subtext">${customers.returningPercentage || 0}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Avg Order Value</div>
                <div class="metric-value">₦${customers.averageOrderValue ? (customers.averageOrderValue / 100).toLocaleString() : 0}</div>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <p>This report was generated automatically from Eventify Analytics</p>
            <p>For questions or support, please contact your event administrator</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print dialog after content loads
      printWindow.onload = () => {
        printWindow.print();
        setIsExporting(false);
      };

      // Fallback in case onload doesn't fire
      setTimeout(() => {
        setIsExporting(false);
      }, 2000);

    } catch (error) {
      console.error("Export failed:", error);
      alert(`Failed to export PDF: ${error.message}`);
      setIsExporting(false);
    }
  };

  /**
   * Generate and copy shareable link to clipboard
   * In production, this would generate a secure share token
   */
  const handleShareLink = async (shareUrl) => {
    if (!analytics || Object.keys(analytics).length === 0) {
      alert("No analytics data available to share");
      return;
    }

    try {
      // In production, you'd call an API to generate a secure share token
      // For now, we'll create a basic shareable URL structure
      const eventId = analytics.overview?.eventId || "unknown";
      const shareUrl = `${window.location.origin}/events/${eventId}/analytics?share=true`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);

      // Show success feedback
      setShareSuccess(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setShareSuccess(false);
      }, 2000);

    } catch (error) {
      console.error("Share failed:", error);
      
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand("copy");
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch (err) {
        alert("Failed to copy link. Please copy manually: " + shareUrl);
      }
      
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      {/* PDF Export Button */}
      <button
        onClick={handleExportPdf}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export PDF Report"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Generating...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </>
        )}
      </button>

      {/* Share Link Button */}
      <button
        onClick={handleShareLink}
        disabled={shareSuccess}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Share Analytics Link"
      >
        {shareSuccess ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="hidden sm:inline text-green-600">Copied!</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </>
        )}
      </button>
    </div>
  );
}