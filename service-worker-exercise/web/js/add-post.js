(function AddPost() {
  "use strict";

  var titleInput;
  var postInput;
  var addPostBtn;

  document.addEventListener("DOMContentLoaded", ready, false);

  // **********************************

  async function ready() {
    titleInput = document.getElementById("new-title");
    postInput = document.getElementById("new-post");
    addPostBtn = document.getElementById("btn-add-post");

    addPostBtn.addEventListener("click", addPost, false);
    titleInput.addEventListener("change", backupPost, false);
    postInput.addEventListener("change", backupPost, false);

    // restore or backup?
    const addPostBackup = await idbKeyval.get("add-post-backup");
    if (addPostBackup) {
      titleInput.value = addPostBackup.title || "";
      postInput.value = addPostBackup.post || "";
    }
  }

  async function backupPost() {
    await idbKeyval.set("add-post-backup", {
      title: titleInput.value,
      post: postInput.value
    });
  }

  async function addPost() {
    if (titleInput.value.length > 0 && postInput.value.length > 0) {
      // dont try posting while offline
      console.log(!isBlogOnline());
      if (!isBlogOnline()) {
        alert(
          "You seem to be currently offline. Please try again once you come back to online."
        );
        return;
      }
      try {
        let res = await fetch("/api/add-post", {
          method: "POST",
          credentials: "same-origin",
          body: JSON.stringify({
            title: titleInput.value,
            post: postInput.value
          })
        });

        if (res && res.ok) {
          let result = await res.json();
          if (result.OK) {
            titleInput.value = "";
            postInput.value = "";
            document.location.href = `/post/${result.postID}`;
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }

      alert("Posting failed. Try again.");
    } else {
      alert("Please enter a title and some blog post content.");
    }
  }
})();
