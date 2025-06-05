import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import prisma from "../db.server";

// Helper to safely access prisma.settings
function getSettingsModelOrThrow() {
  if (!prisma.settings) {
    throw new Error(
      "Prisma model `Settings` is undefined. Did you run `npx prisma generate` and restart the server?"
    );
  }
  return prisma.settings;
}

export async function loader() {
  const settings = await getSettingsModelOrThrow().findFirst();
  return json({ settings });
}

export async function action({ request }) {
  const formData = await request.formData();
  const apiKey = formData.get("apiKey")?.toString() || "";
  const tag = formData.get("tag")?.toString() || "";

  const model = getSettingsModelOrThrow();
  const existing = await model.findFirst();

  if (existing) {
    await model.update({
      where: { id: existing.id },
      data: { apiKey, tag },
    });
  } else {
    await model.create({
      data: { apiKey, tag },
    });
  }

  return json({ success: true });
}

export default function SettingsPage() {
  const { settings } = useLoaderData();
  const actionData = useActionData();

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Settings</h1>

      {actionData?.success && (
        <div style={styles.successBanner}>
          ✅ Settings saved successfully!
        </div>
      )}

      <Form method="post" style={styles.form}>
        <div style={styles.formGroup}>
          <label htmlFor="apiKey" style={styles.label}>API Key</label>
          <input
            type="text"
            name="apiKey"
            id="apiKey"
            defaultValue={settings?.apiKey || ""}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="tag" style={styles.label}>Tag</label>
          <input
            type="text"
            name="tag"
            id="tag"
            defaultValue={settings?.tag || ""}
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.button}>
          Save Settings
        </button>
      </Form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "480px",
    margin: "40px auto",
    padding: "24px",
    backgroundColor: "#fff",
    border: "1px solid #E1E3E5",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  heading: {
    fontSize: "24px",
    fontWeight: "600",
    marginBottom: "24px",
    color: "#202223",
  },
  successBanner: {
    padding: "12px",
    backgroundColor: "#e3f1df",
    color: "#2d4821",
    borderRadius: "8px",
    border: "1px solid #b6dfb0",
    marginBottom: "16px",
    fontSize: "14px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "6px",
    color: "#202223",
  },
  input: {
    fontSize: "14px",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #C4C4C4",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  button: {
    marginTop: "12px",
    padding: "10px 16px",
    backgroundColor: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "14px",
  },
};
