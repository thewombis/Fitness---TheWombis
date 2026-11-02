"use strict";

/* Photo Diary tab: progress photos stored on-device in IndexedDB.
   Nothing is uploaded. Features: front/side/back angles by date, camera
   capture or file upload, a "ghost" overlay of the previous same-angle
   photo for consistent framing, and a per-angle time-lapse player. */

window.Photos = (function () {
  var DB_NAME = "calorie-counter-photos-v1";
  var STORE = "photos";
  var dbPromise = null;
  var currentAngle = "front";
  var pendingBlob = null;
  var stream = null;
  var tlTimer = null;
  var liveUrls = [];

  function $(id) { return document.getElementById(id); }

  function todayStr() {
    var dt = new Date();
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var day = String(dt.getDate()).padStart(2, "0");
    return dt.getFullYear() + "-" + m + "-" + day;
  }

  function status(msg, isError) {
    var el = $("photo-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "status" + (isError ? " error" : "");
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) { reject(new Error("IndexedDB is not available in this browser.")); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("angle", "angle", { unique: false });
          store.createIndex("date", "date", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out._result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("Transaction aborted")); };
      });
    });
  }

  function getAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function addPhoto(rec) {
    return tx("readwrite", function (store) { store.add(rec); });
  }

  function deletePhoto(id) {
    return tx("readwrite", function (store) { store.delete(id); });
  }

  function clearPhotos() {
    return tx("readwrite", function (store) { store.clear(); });
  }

  function objUrl(blob) {
    var u = URL.createObjectURL(blob);
    liveUrls.push(u);
    return u;
  }

  function revokeUrls() {
    liveUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    liveUrls = [];
  }

  function sortPhotos(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.id - b.id;
    });
  }

  /* ---------- Ghost overlay ---------- */
  function refreshGhost() {
    return getAll().then(function (all) {
      var mine = sortPhotos(all.filter(function (p) { return p.angle === currentAngle; }));
      var ghost = $("photo-ghost");
      var label = $("photo-frame-label");
      if (mine.length) {
        var last = mine[mine.length - 1];
        ghost.src = objUrl(last.blob);
        ghost.hidden = false;
        label.textContent = "Ghost: your last " + currentAngle + " photo (" + last.date + "). Line yourself up with it, then capture or choose today's photo.";
      } else {
        ghost.hidden = true;
        ghost.removeAttribute("src");
        label.textContent = "No " + currentAngle + " photo yet — this will be the first one future photos line up against.";
      }
    }).catch(function () { /* gallery refresh will surface DB errors */ });
  }

  /* ---------- Gallery ---------- */
  function refreshGallery() {
    revokeUrls();
    return getAll().then(function (all) {
      var box = $("photo-gallery");
      if (!all.length) {
        box.innerHTML = '<p class="hint">No progress photos yet. Add your first one above.</p>';
        return refreshGhost();
      }
      var byDate = {};
      all.forEach(function (p) { (byDate[p.date] = byDate[p.date] || []).push(p); });
      var dates = Object.keys(byDate).sort().reverse();
      box.innerHTML = dates.map(function (date) {
        var thumbs = sortPhotos(byDate[date]).map(function (p) {
          return '<div class="photo-thumb"><img src="' + objUrl(p.blob) + '" alt="' + p.angle + ' progress photo on ' + date + '">' +
            '<button type="button" class="thumb-del" data-del-photo="' + p.id + '" aria-label="Delete ' + p.angle + ' photo on ' + date + '">&times;</button>' +
            '<span class="thumb-label">' + p.angle + "</span></div>";
        }).join("");
        return '<div class="photo-date-group"><h3>' + date + '</h3><div class="photo-thumbs">' + thumbs + "</div></div>";
      }).join("");
      box.querySelectorAll("[data-del-photo]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = Number(btn.getAttribute("data-del-photo"));
          deletePhoto(id).then(function () {
            status("Photo deleted.");
            refreshGallery();
          }).catch(function () { status("Could not delete that photo.", true); });
        });
      });
      return refreshGhost();
    }).catch(function (e) {
      $("photo-gallery").innerHTML = '<p class="hint">Photo storage is unavailable in this browser (' +
        (e && e.message ? e.message : "unknown error") + ").</p>";
    });
  }

  /* ---------- Capture / save ---------- */
  function currentDate() { return $("photo-date").value || todayStr(); }

  function saveBlob(blob) {
    if (!blob) return;
    addPhoto({ date: currentDate(), angle: currentAngle, blob: blob, createdAt: Date.now() })
      .then(function () {
        status("Saved your " + currentAngle + " photo for " + currentDate() + ".");
        pendingBlob = null;
        $("photo-save-file").disabled = true;
        $("photo-preview").hidden = true;
        $("photo-preview").removeAttribute("src");
        $("photo-file").value = "";
        refreshGallery();
      })
      .catch(function () { status("Could not save the photo — browser storage may be full or blocked.", true); });
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    var video = $("photo-video");
    if (video) { video.hidden = true; video.srcObject = null; }
    var ghost = $("photo-ghost");
    if (ghost) ghost.style.zIndex = "";
    if ($("photo-cam-start")) $("photo-cam-start").disabled = false;
    if ($("photo-cam-capture")) $("photo-cam-capture").disabled = true;
    if ($("photo-cam-stop")) $("photo-cam-stop").disabled = true;
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status("This browser cannot open a camera here. Use the file picker instead — on a phone it offers the camera as a source.", true);
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(function (s) {
        stream = s;
        var video = $("photo-video");
        video.srcObject = s;
        video.hidden = false;
        $("photo-preview").hidden = true;
        var ghost = $("photo-ghost");
        if (ghost && !ghost.hidden) ghost.style.zIndex = "3"; // ghost floats over the live video for framing
        $("photo-frame-label").textContent = "Camera on. The faint image is your last " + currentAngle + " photo — match your position to it, then Capture.";
        return video.play();
      })
      .then(function () {
        $("photo-cam-start").disabled = true;
        $("photo-cam-capture").disabled = false;
        $("photo-cam-stop").disabled = false;
        status("");
      })
      .catch(function () {
        status("Could not start the camera (permission denied or no camera). The file picker still works.", true);
        stopCamera();
      });
  }

  function capturePhoto() {
    var video = $("photo-video");
    if (!stream || !video.videoWidth) return;
    // Center-crop to the frame's 3:4 aspect so captures line up with uploads.
    var targetRatio = 3 / 4;
    var vw = video.videoWidth, vh = video.videoHeight;
    var sw, sh, sx, sy;
    if (vw / vh > targetRatio) { sh = vh; sw = vh * targetRatio; sx = (vw - sw) / 2; sy = 0; }
    else { sw = vw; sh = vw / targetRatio; sx = 0; sy = (vh - sh) / 2; }
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext("2d").drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) { stopCamera(); saveBlob(blob); }, "image/jpeg", 0.9);
    } else {
      status("Capturing is not supported in this browser. Use the file picker instead.", true);
    }
  }

  /* ---------- Time-lapse ---------- */
  function stopTimeLapse() {
    if (tlTimer) { clearInterval(tlTimer); tlTimer = null; }
    if ($("tl-play")) $("tl-play").disabled = false;
    if ($("tl-stop")) $("tl-stop").disabled = true;
  }

  function playTimeLapse() {
    var angle = $("tl-angle").value;
    getAll().then(function (all) {
      var mine = sortPhotos(all.filter(function (p) { return p.angle === angle; }));
      if (!mine.length) {
        $("tl-caption").textContent = "No " + angle + " photos yet — add some above first.";
        return;
      }
      stopTimeLapse();
      var viewer = $("tl-viewer");
      viewer.hidden = false;
      var i = 0;
      function show() {
        var p = mine[i];
        viewer.src = objUrl(p.blob);
        $("tl-caption").textContent = angle + " · " + p.date + " · " + (i + 1) + " of " + mine.length;
        i = (i + 1) % mine.length;
      }
      show();
      if (mine.length > 1) tlTimer = setInterval(show, 850);
      $("tl-play").disabled = true;
      $("tl-stop").disabled = false;
    }).catch(function () {
      $("tl-caption").textContent = "Photo storage is unavailable in this browser.";
    });
  }

  /* ---------- Init ---------- */
  function init() {
    if (!$("photo-date")) return;
    $("photo-date").value = todayStr();

    document.querySelectorAll("[data-photo-angle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentAngle = btn.getAttribute("data-photo-angle");
        document.querySelectorAll("[data-photo-angle]").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        pendingBlob = null;
        $("photo-save-file").disabled = true;
        $("photo-preview").hidden = true;
        stopCamera();
        refreshGhost();
      });
    });

    $("photo-file").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      pendingBlob = f;
      var prev = $("photo-preview");
      prev.src = objUrl(f);
      prev.hidden = false;
      $("photo-save-file").disabled = false;
      status("Photo ready — press Save photo to store it as your " + currentAngle + " shot for " + currentDate() + ".");
    });

    $("photo-save-file").addEventListener("click", function () { saveBlob(pendingBlob); });
    $("photo-cam-start").addEventListener("click", startCamera);
    $("photo-cam-capture").addEventListener("click", capturePhoto);
    $("photo-cam-stop").addEventListener("click", stopCamera);
    $("photo-date").addEventListener("change", function () { /* date only affects the next save */ });

    $("tl-play").addEventListener("click", playTimeLapse);
    $("tl-stop").addEventListener("click", function () {
      stopTimeLapse();
      $("tl-caption").textContent = "Time-lapse stopped.";
    });
    $("tl-angle").addEventListener("change", stopTimeLapse);

    var eraseBtn = $("photo-erase-all");
    if (eraseBtn) {
      eraseBtn.addEventListener("click", function () {
        if (!window.confirm("Erase ALL progress photos stored in this browser? This cannot be undone.")) return;
        clearPhotos().then(function () {
          stopTimeLapse();
          $("tl-viewer").hidden = true;
          status("All progress photos erased.");
          refreshGallery();
        }).catch(function () { status("Could not erase photos.", true); });
      });
    }

    refreshGallery();
  }

  document.addEventListener("DOMContentLoaded", init);
  return { stopCamera: stopCamera };
})();
