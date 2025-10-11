const { v4: uuidv4 } = require("uuid");

const ContactSubmission = require("../../models/contact_submissions");
const SGDevStudioClient = require("../../models/sgdevstudio_clients");

const registerConnectRequest = async (name, email, message) => {
  try {
    // Check if a document with this email already exists
    const existingSubmission = await ContactSubmission.findOne({ email });

    if (existingSubmission) {
      // If it exists, append the new message to the existing list
      existingSubmission.messages.push({
        message,
        date: new Date(),
      });

      await existingSubmission.save();
      return {
        success: true,
        message: "Message appended successfully",
        data: existingSubmission,
      };
    } else {
      // If not, create a new document with a messages array
      const newSubmission = new ContactSubmission({
        name,
        email,
        messages: [
          {
            message,
            date: new Date(),
          },
        ],
      });

      await newSubmission.save();
      return {
        success: true,
        message: "New contact submission created successfully",
        data: newSubmission,
      };
    }
  } catch (error) {
    console.error("Error in registerConnectRequest:", error);
    throw error;
  }
};

const registerVisitorHelper = async (reqData) => {
  try {
    const client_id = `cl-${uuidv4()}`;
    client_details = {
      client_id,
      ip: reqData?.ip || "",
      country_name: reqData?.country_name || "",
      city: reqData?.city || "",
      created_at: new Date(),
    };
    const client = new SGDevStudioClient(client_details);
    await client.save();
    console.log(
      "Client Registered Successfully with IP : ",
      client_details?.ip
    );
    return { success: true, client_id };
  } catch (error) {
    console.error("Error in registerVisitorHelper:", error);
    throw error;
  }
};
module.exports = { registerConnectRequest, registerVisitorHelper };
