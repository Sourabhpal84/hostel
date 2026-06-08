const seedData = {
  settings: {
    pgName: "Imperial PG",
    about: "Premium PG hostel with managed admission, fees, complaints, food timetable, notices, room media, and student dashboards.",
    rentHeadline: "Starting from Rs. 7,500/month",
    rentDetails: "Single seater, double seater, AC and non-AC rooms available. Admin can update rent anytime.",
    promoImage: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1400&q=80",
    promoLink: "https://magneetoz.com"
  },
  rooms: [
    {
      title: "Executive Single AC",
      rent: "Rs. 14,000/month",
      image: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=900&q=85",
      video: "https://www.youtube.com",
      features: ["Single seater", "AC", "Study desk", "Attached washroom"]
    },
    {
      title: "Premium Double Sharing",
      rent: "Rs. 9,500/month",
      image: "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=900&q=85",
      video: "https://www.youtube.com",
      features: ["Double seater", "Non AC", "Wardrobe", "Wi-Fi"]
    },
    {
      title: "Comfort Non AC",
      rent: "Rs. 7,500/month",
      image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85",
      video: "https://www.youtube.com",
      features: ["Budget room", "Clean bedding", "Food included", "Laundry option"]
    }
  ],
  notices: ["Welcome to Imperial PG. Fees are due before the 7th of every month."],
  meals: "Breakfast: 8:00 AM - 9:30 AM\nLunch: 1:00 PM - 2:30 PM\nDinner: 8:00 PM - 9:30 PM",
  students: [
    {
      name: "Rahul Sharma",
      studentId: "IPG1001",
      email: "rahul@student.com",
      password: "123456",
      phone: "9999999999",
      room: "201",
      bed: "B1",
      roomType: "Double Seater",
      acType: "AC",
      totalFee: 30000,
      paidFee: 18000
    }
  ],
  complaints: []
};

let state = loadState();
let currentStudent = null;

function loadState() {
  const saved = localStorage.getItem("pgHostelData");
  return saved ? JSON.parse(saved) : structuredClone(seedData);
}

function saveState() {
  localStorage.setItem("pgHostelData", JSON.stringify(state));
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function openPanel(id) {
  qs("#overlay").hidden = false;
  qs(`#${id}`).hidden = false;
}

function closePanels() {
  qs("#overlay").hidden = true;
  qsa(".drawer").forEach((panel) => panel.hidden = true);
}

function renderPublic() {
  const settings = state.settings;
  qs("#brandName").textContent = settings.pgName;
  qs("#heroTitle").textContent = settings.pgName;
  qs("#heroAbout").textContent = settings.about;
  qs("#aboutText").textContent = settings.about;
  qs("#rentHeadline").textContent = settings.rentHeadline;
  qs("#rentDetails").textContent = settings.rentDetails;
  qs("#promoImage").src = settings.promoImage;
  qs("#promoLink").href = settings.promoLink || "https://magneetoz.com";

  qs("#roomGrid").innerHTML = state.rooms.map((room) => `
    <article class="room-card">
      <img src="${room.image}" alt="${room.title}">
      <div class="room-body">
        <h3>${room.title}</h3>
        <strong>${room.rent}</strong>
        <div class="chips">${room.features.map((item) => `<span>${item}</span>`).join("")}</div>
        ${room.video ? `<p><a href="${room.video}" target="_blank" rel="noopener">Watch room video</a></p>` : ""}
      </div>
    </article>
  `).join("");

  renderActivity("notices");
}

function renderActivity(type) {
  qsa(".side-tab").forEach((button) => button.classList.toggle("active", button.dataset.activity === type));
  const content = qs("#activityContent");

  if (type === "notices") {
    content.innerHTML = `<h2>Notice Board</h2>${state.notices.map((notice) => `<div class="notice-item">${notice}</div>`).join("")}`;
    return;
  }

  if (type === "meals") {
    const lines = state.meals.split("\n").filter(Boolean);
    content.innerHTML = `<h2>Food Time Table</h2>${lines.map((line) => `<div class="meal-line">${line}</div>`).join("")}`;
    return;
  }

  const roomOptions = state.students.map((student) => `<option value="${student.studentId}">${student.name} - ${student.room}/${student.bed}</option>`).join("");
  content.innerHTML = `
    <h2>Complaint / Request</h2>
    <form id="complaintForm" class="complaint-form">
      <input name="name" placeholder="Your name" required>
      <select name="studentId" required>${roomOptions || "<option>No admitted students yet</option>"}</select>
      <input name="room" placeholder="Room number" required>
      <input name="bed" placeholder="Bed number" required>
      <textarea name="message" placeholder="Write complaint or request" required></textarea>
      <button class="solid-btn">Submit Complaint</button>
    </form>
  `;
  qs("#complaintForm").addEventListener("submit", submitComplaint);
}

function renderAdmin() {
  const totalCollected = state.students.reduce((sum, student) => sum + Number(student.paidFee || 0), 0);
  const totalPending = state.students.reduce((sum, student) => sum + Math.max(Number(student.totalFee || 0) - Number(student.paidFee || 0), 0), 0);
  qs("#studentCount").textContent = state.students.length;
  qs("#totalCollected").textContent = money(totalCollected);
  qs("#totalPending").textContent = money(totalPending);

  qs("#studentTable").innerHTML = state.students.map((student, index) => `
    <div class="row">
      <div>
        <strong>${student.name}</strong>
        <small>${student.studentId} | ${student.email} | Room ${student.room}, Bed ${student.bed}</small>
        <small>Total ${money(student.totalFee)} | Paid ${money(student.paidFee)} | Pending ${money(student.totalFee - student.paidFee)}</small>
      </div>
      <div class="mini-actions">
        <input aria-label="Update fee" id="fee-${index}" type="number" value="${student.paidFee}">
        <button class="solid-btn success" onclick="updateFee(${index})">Update</button>
        <button class="solid-btn danger" onclick="deleteStudent(${index})">Delete</button>
      </div>
    </div>
  `).join("") || "<p class='muted'>No students yet.</p>";

  qs("#complaintList").innerHTML = state.complaints.map((complaint, index) => `
    <div class="row">
      <div>
        <strong>${complaint.name}</strong>
        <small>${complaint.studentId} | Room ${complaint.room}, Bed ${complaint.bed} | ${complaint.status}</small>
        <p>${complaint.message}</p>
      </div>
      <button class="solid-btn success" onclick="resolveComplaint(${index})">Resolved</button>
    </div>
  `).join("") || "<p class='muted'>No complaints yet.</p>";
}

function renderStudent(student) {
  const pending = Number(student.totalFee || 0) - Number(student.paidFee || 0);
  qs("#studentDashName").textContent = student.name;
  qs("#studentDetail").innerHTML = `
    <h3>${student.name}</h3>
    <div class="fee-box">Student ID: <strong>${student.studentId}</strong></div>
    <div class="fee-box">Room: <strong>${student.room}</strong> | Bed: <strong>${student.bed}</strong> | ${student.roomType} | ${student.acType}</div>
    <div class="fee-box">Total Fees: <strong>${money(student.totalFee)}</strong></div>
    <div class="fee-box">Submitted Fees: <strong>${money(student.paidFee)}</strong></div>
    <div class="fee-box">Pending Fees: <strong>${money(pending)}</strong></div>
    <h3>Announcements</h3>
    ${state.notices.map((notice) => `<div class="notice-item">${notice}</div>`).join("")}
    <h3>Meal Time Table</h3>
    ${state.meals.split("\n").filter(Boolean).map((line) => `<div class="meal-line">${line}</div>`).join("")}
  `;
}

function submitComplaint(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  state.complaints.unshift({ ...data, status: "Pending" });
  saveState();
  event.target.reset();
  alert("Complaint admin dashboard me submit ho gayi hai.");
}

window.updateFee = function updateFee(index) {
  state.students[index].paidFee = Number(qs(`#fee-${index}`).value || 0);
  saveState();
  renderAdmin();
  if (currentStudent?.studentId === state.students[index].studentId) {
    currentStudent = state.students[index];
    renderStudent(currentStudent);
  }
};

window.deleteStudent = function deleteStudent(index) {
  state.students.splice(index, 1);
  saveState();
  renderAdmin();
};

window.resolveComplaint = function resolveComplaint(index) {
  state.complaints[index].status = "Resolved";
  saveState();
  renderAdmin();
};

qsa("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", () => openPanel(button.dataset.openPanel));
});

qsa("[data-close-panel], #overlay").forEach((item) => item.addEventListener("click", closePanels));

qsa("[data-close-dashboard]").forEach((button) => {
  button.addEventListener("click", () => {
    qsa(".dashboard").forEach((panel) => panel.hidden = true);
  });
});

qsa(".side-tab").forEach((button) => button.addEventListener("click", () => renderActivity(button.dataset.activity)));

qs("#adminLoginBtn").addEventListener("click", () => {
  if (qs("#adminEmail").value === "admin@pg.com" && qs("#adminPassword").value === "admin123") {
    closePanels();
    renderAdmin();
    qs("#adminDashboard").hidden = false;
    return;
  }
  alert("Admin email ya password galat hai.");
});

qs("#studentLoginBtn").addEventListener("click", () => {
  const student = state.students.find((item) => item.email === qs("#studentEmail").value && item.password === qs("#studentPassword").value);
  if (!student) {
    alert("Student login details match nahi hui.");
    return;
  }
  currentStudent = student;
  closePanels();
  renderStudent(student);
  qs("#studentDashboard").hidden = false;
});

qs("#admissionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const student = Object.fromEntries(new FormData(event.target).entries());
  student.totalFee = Number(student.totalFee || 0);
  student.paidFee = Number(student.paidFee || 0);
  state.students.unshift(student);
  saveState();
  event.target.reset();
  renderAdmin();
});

qs("#contentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  Object.keys(data).forEach((key) => {
    if (data[key]) state.settings[key] = data[key];
  });
  saveState();
  renderPublic();
  renderAdmin();
});

qs("#roomForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const room = Object.fromEntries(new FormData(event.target).entries());
  room.features = room.features.split(",").map((item) => item.trim()).filter(Boolean);
  state.rooms.unshift(room);
  saveState();
  event.target.reset();
  renderPublic();
});

qs("#noticeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const notice = new FormData(event.target).get("notice");
  if (notice) state.notices.unshift(notice);
  saveState();
  event.target.reset();
  renderPublic();
  renderAdmin();
});

qs("#mealForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const meals = new FormData(event.target).get("meals");
  if (meals) state.meals = meals;
  saveState();
  event.target.reset();
  renderPublic();
});

renderPublic();
