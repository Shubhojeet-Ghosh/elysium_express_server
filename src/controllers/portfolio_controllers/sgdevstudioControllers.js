const {
  registerConnectRequest,
  registerVisitorHelper,
} = require("../../helpers/sgdevstudio_helpers/connectHelpers");

const contactSubmission = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    console.log(name, email, message);

    register_response = await registerConnectRequest(name, email, message);

    return res.status(200).json({
      success: true,
      message:
        "Your request to connect with us has been registered successfully.",
    });
  } catch (error) {
    console.error("Error in contactSubmission:", error);
    return res.status(500).json({
      success: false,
      message:
        "Something went wrong in registering your request to connect with us.",
      tech_message: error.message,
    });
  }
};

const registerVisitorController = async (req, res) => {
  try {
    register_result = await registerVisitorHelper();
    if (register_result.success) {
      return res.status(200).json({
        success: true,
        message: "Visitor registered successfully.",
        client_id: register_result.client_id,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Something went wrong in registering your visitor.",
        tech_message: register_result.message,
      });
    }
  } catch (error) {
    console.error("Error in registerVisitor:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong in registering your visitor.",
      tech_message: error.message,
    });
  }
};

module.exports = {
  contactSubmission,
  registerVisitorController,
};
