const User = require("../../models/users");
const Contacts = require("../../models/contacts");
const ContactRelation = require("../../models/contact_relations");

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
      // Look up the relation
      const relation = await ContactRelation.findOne({
        user_id: current_user_id,
        contact_id: user._id.toString(),
      });

      if (relation) {
        status = relation.status;
        is_contact = ["accepted", "pending", "blocked"].includes(status);
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

const getUserContactList = async (req, res) => {
  try {
    const current_user_id = req.user.user_id;
    const { status = "accepted" } = req.body; // default to accepted if not provided

    console.log(`Getting '${status}' contact list for user:`, req.user.email);

    // Step 1: Get relations for the given status
    const relations = await ContactRelation.find({
      user_id: current_user_id,
      status,
    });

    if (!relations.length) {
      return res.json({ success: true, contacts: [] });
    }

    // Step 2: Collect all contact_ids
    const contactIds = relations.map((r) => r.contact_id);

    // Step 3: Fetch users matching those contact_ids
    const users = await User.find(
      { _id: { $in: contactIds } },
      "first_name last_name profile_image_url email"
    ).lean();

    // Step 4: Merge relations with user info
    const contacts = relations.map((relation) => {
      const user = users.find((u) => u._id.toString() === relation.contact_id);
      return {
        user_id: relation.contact_id,
        email: user?.email || "",
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        profile_image_url: user?.profile_image_url || null,
        alias_name: relation.alias_name || null,
        status: relation.status,
      };
    });

    console.log(`${status} contact list:`, contacts.length);

    return res.json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error("Error fetching user contact list:", error);
    return res.json({
      success: false,
      message: "Something went wrong.",
      tech_message: error.message,
    });
  }
};

module.exports = {
  getUserByEmail,
  getUserContactList,
};
