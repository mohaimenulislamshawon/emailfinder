// Submitted URLs tracker
let submittedUrls = [];
let messageTimeout = null;

// Show status message without blocking
function showMessage(message, type = 'success') {
    clearTimeout(messageTimeout);

    // Create message element if it doesn't exist
    let msgEl = document.getElementById("statusMessage");
    if (!msgEl) {
        msgEl = document.createElement("div");
        msgEl.id = "statusMessage";
        msgEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(msgEl);
    }

    msgEl.textContent = message;
    msgEl.style.background = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#f59e0b');
    msgEl.style.display = 'block';

    // Auto-hide after 5 seconds
    messageTimeout = setTimeout(() => {
        msgEl.style.display = 'none';
    }, 5000);
}

async function submitUrl() {
    const input = document.getElementById("urlInput").value;

    // Split bulk input (one per line)
    const urls = input
        .split("\n")
        .map(u => u.trim())
        .filter(u => u);

    if (urls.length === 0) {
        showMessage("❌ Please enter at least one URL", "error");
        return;
    }

    // Validate URLs
    const validUrls = urls.filter(url => {
        try {
            new URL(url.startsWith("http") ? url : "https://" + url);
            return true;
        } catch {
            return false;
        }
    });

    if (validUrls.length === 0) {
        showMessage("❌ No valid URLs entered", "error");
        return;
    }

    if (validUrls.length < urls.length) {
        showMessage(`⚠️  ${urls.length - validUrls.length} invalid URL(s) skipped`, "warning");
    }

    showLoading(true);
    submittedUrls = validUrls;

    let successCount = 0;
    let failCount = 0;

    try {
        // Submit all URLs in parallel (not one by one)
        const promises = validUrls.map(url =>
            fetch("/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            })
                .then(response => {
                    if (response.ok) {
                        successCount++;
                        console.log("✅ Submitted:", url);
                    } else {
                        failCount++;
                        console.error("❌ Failed to submit:", url);
                    }
                })
                .catch(err => {
                    failCount++;
                    console.error("Submit error for", url, ":", err.message);
                })
        );

        // Wait for all submissions
        await Promise.all(promises);

        // Show non-blocking message
        const message = `✅ Submitted ${successCount}/${validUrls.length} URL(s). Processing started...`;
        showMessage(message, "success");
        console.log(message);

    } catch (err) {
        console.error("Submit error:", err);
        showMessage("❌ Error: " + err.message, "error");
    } finally {
        showLoading(false);
        document.getElementById("urlInput").value = "";
    }
}

function showLoading(show) {
    document.getElementById("loading").style.display = show ? "block" : "none";
}

// Track checked state across re-renders (keyed by email string)
let checkedEmails = new Set();

// 🔄 Load results continuously
async function loadResults() {
    try {
        const res = await fetch("/results");
        if (!res.ok) {
            console.error("Failed to fetch results");
            return;
        }

        const data = await res.json();
        const table = document.getElementById("resultsTable");
        table.innerHTML = "";

        if (data.length === 0) {
            table.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 30px;">⏳ No results yet. Submit URLs to start...</td></tr>';
            updateSelectedCount();
            return;
        }

        // Track all currently available emails to clean up stale checked entries
        let allCurrentEmails = new Set();

        data.forEach((site, index) => {
            const status = site.error ? "❌ " + site.error.substring(0, 20) : "✅ Found";

            // Get all emails (top email + all emails)
            let emailsHtml = "N/A";
            let emailsArray = [];

            if (site.all_emails && site.all_emails.length > 0) {
                emailsArray = site.all_emails.map(e => ({ email: e.email, count: e.count }));
            } else if (site.top_email) {
                emailsArray = [{ email: site.top_email.email, count: site.top_email.found_times }];
            }

            if (emailsArray.length > 0) {
                const emailList = emailsArray.map(e => {
                    const emailId = `email-${escapeAttr(e.email)}`;
                    const isChecked = checkedEmails.has(e.email) ? 'checked' : '';
                    allCurrentEmails.add(e.email);
                    return `<label class="email-checkbox-item">
                        <input type="checkbox" class="email-tick" value="${escapeAttr(e.email)}" ${isChecked} onchange="onEmailCheckChange(this)">
                        <span class="email-text">${escapeHtml(e.email)}</span>
                        <span class="email-count">(${e.count})</span>
                    </label>`;
                }).join("");
                emailsHtml = `<div class="email-list">${emailList}</div>`;
            }

            // Build row without the old checkbox column
            const emailsText = emailsArray.map(e => e.email).join("\\n").replace(/"/g, '\\"');

            const row = `
                <tr class="result-row">
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(site.domain)}</strong></td>
                    <td>${emailsHtml}</td>
                    <td>${status}</td>
                    <td>
                        <button class="btn-copy-small" onclick="copyEmails('${emailsText}', this)">📋 Copy All</button>
                    </td>
                </tr>
            `;

            table.innerHTML += row;
        });

        // Clean up checked emails that are no longer in results
        for (const email of checkedEmails) {
            if (!allCurrentEmails.has(email)) {
                checkedEmails.delete(email);
            }
        }

        updateSelectedCount();

    } catch (err) {
        console.error("Load error:", err);
    }
}

// Handle individual email checkbox changes
function onEmailCheckChange(checkbox) {
    if (checkbox.checked) {
        checkedEmails.add(checkbox.value);
    } else {
        checkedEmails.delete(checkbox.value);
    }
    updateSelectedCount();
}

// Update the selected count display
function updateSelectedCount() {
    const countEl = document.getElementById("selectedCount");
    if (countEl) {
        const count = checkedEmails.size;
        countEl.textContent = `${count} selected`;
        countEl.classList.toggle("has-selection", count > 0);
    }
}

// Select all email checkboxes
function selectAllEmails() {
    const checkboxes = document.querySelectorAll(".email-tick");
    checkboxes.forEach(cb => {
        cb.checked = true;
        checkedEmails.add(cb.value);
    });
    updateSelectedCount();
}

// Deselect all email checkboxes
function deselectAllEmails() {
    const checkboxes = document.querySelectorAll(".email-tick");
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    checkedEmails.clear();
    updateSelectedCount();
}

// 📋 Copy only checked emails
function copyCheckedEmails() {
    if (checkedEmails.size === 0) {
        showMessage("⚠️  No emails selected. Tick the emails you want to copy.", "warning");
        return;
    }

    const emailsList = [...checkedEmails];
    const textToCopy = emailsList.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
        showMessage(`✅ Copied ${emailsList.length} selected email(s) to clipboard!`, "success");
    }).catch(err => {
        console.error("Copy failed:", err);
        showMessage("❌ Failed to copy emails", "error");
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

// Helper function to escape attribute values
function escapeAttr(text) {
    return text ? String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
}

// 📋 Copy emails for a single domain row
function copyEmails(emailText, button) {
    const emails = emailText.split('\\n').filter(e => e.trim());
    const cleanText = emails.join('\n');

    navigator.clipboard.writeText(cleanText).then(() => {
        const originalText = button.textContent;
        button.textContent = "✅ Copied!";
        button.style.background = "#10b981";

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = "";
        }, 2000);

        showMessage(`✅ Copied ${emails.length} email(s) to clipboard`, "success");
    }).catch(err => {
        console.error("Copy failed:", err);
        showMessage("❌ Failed to copy emails", "error");
    });
}

// Clear results
function clearResults() {
    if (confirm("⚠️  Clear all results?")) {
        fetch("/clear", { method: "POST" })
            .then(() => {
                document.getElementById("resultsTable").innerHTML = '';
                checkedEmails.clear();
                updateSelectedCount();
                showMessage("✅ Results cleared", "success");
                loadResults();
            })
            .catch(err => showMessage("❌ Error clearing results", "error"));
    }
}

// Poll every 1 second for instant updates
setInterval(loadResults, 1000);

// Initial load
loadResults();