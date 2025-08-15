const User = require("../../models/users");
const Contacts = require("../../models/contacts");

const getUserByEmail = async (req, res) => {
  const current_user_id = req.user.user_id;
  const { email } = req.body;

  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      is_profile_complete: true,
    });

    if (!user) {
      return res.json({
        success: false,
        message: "No user found with this email.",
      });
    }

    // Default values
    let is_contact = false;
    let status = null;

    // Ensure current_user_id is passed and not same as the searched user
    if (current_user_id && current_user_id !== user._id.toString()) {
      const contactsDoc = await Contacts.findOne({ _id: current_user_id });

      if (contactsDoc && Array.isArray(contactsDoc.contacts)) {
        const contactEntry = contactsDoc.contacts.find(
          (c) => c.user_id === user._id.toString()
        );

        if (contactEntry) {
          status = contactEntry.status;
          //   is this correct?
          is_contact =
            status === "accepted" ||
            status === "pending" ||
            status === "blocked";
        }
      }
    }

    const userPayload = {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_image_url: user.profile_image_url,
      createdAt: user.createdAt,
      is_contact,
      status,
    };

    return res.status(200).json({ success: true, user: userPayload });
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return res.json({
      success: false,
      message: "Something went wrong.",
      tech_message: error.message,
    });
  }
};

module.exports = {
  getUserByEmail,
};
