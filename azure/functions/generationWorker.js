// Azure Functions (Node) — Service Bus trigger template.
// Deploy with `func azure functionapp publish <app-name>` after `npm install` in this folder.

module.exports = async function (context, sbMsg) {
  context.log("Generation job received:", sbMsg);
  // TODO: load job from DB, call OpenAI / Vision / try-on, update GenerationJob, upload blob
};
