// app/routes/products.jsx

import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import prisma from "../db.server";
import { useState } from "react";

export async function loader({ request }) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "asc";

  const orderBy =
    sort === "latest"
      ? { createdAt: "desc" }
      : { title: "asc" };

  const products = await prisma.product.findMany({
    orderBy,
  });

  return json({ products });
}

export default function ProductsPage() {
  const { products } = useLoaderData();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("success");

  const success = products.filter((p) => !p.error_handle);
  const failed = products.filter((p) => p.error_handle);

  return (
    <>
      {/* Inline styles to mimic Polaris */}
      <style>{`
        .product-page { padding: 24px; font-family: ShopifySans, sans-serif; }
        .product-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #212B36; }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab {
          padding: 8px 16px;
          border-radius: 4px;
          background: #F4F6F8;
          color: #1D1F21;
          border: 1px solid transparent;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .tab.active {
          background: #C4DFFF;
          color: #0065FF;
          border-color: #0065FF;
        }
        .sort-select {
          margin-bottom: 16px;
          font-size: 14px;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .table-wrapper {
          overflow-x: auto;
          border: 1px solid #DFE3E8;
          border-radius: 4px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          min-width: 600px;
        }
        .data-table th {
          background: #F4F6F8;
          color: #6B6B6B;
          text-transform: uppercase;
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid #DFE3E8;
        }
        .data-table td {
          padding: 8px;
          color: #212B36;
          border-bottom: 1px solid #E1E3E5;
        }
        .data-table tr:nth-child(even) td {
          background: #FBFDFF;
        }
      `}</style>

      <main className="product-page">
        <h1 className="product-title">Products</h1>

        {/* Sort dropdown */}
        <Form method="get">
          <select
            name="sort"
            defaultValue={searchParams.get("sort") || "asc"}
            className="sort-select"
            onChange={(e) => e.currentTarget.form.submit()}
          >
            <option value="asc">Sort by A–Z</option>
            <option value="latest">Sort by Latest</option>
          </select>
        </Form>

        {/* Tabs */}
        <nav className="tabs">
          <button
            className={`tab${activeTab === "success" ? " active" : ""}`}
            onClick={() => setActiveTab("success")}
          >
            Active Products ({success.length})
          </button>
          <button
            className={`tab${activeTab === "failed" ? " active" : ""}`}
            onClick={() => setActiveTab("failed")}
          >
            Failed Products ({failed.length})
          </button>
        </nav>

        {/* Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shopify ID</th>
                <th>Title</th>
                <th>Handle</th>
                <th>Order ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === "success" ? success : failed).map((p) => (
                <tr key={p.id}>
                  <td>{p.shopifyId}</td>
                  <td>{p.title}</td>
                  <td>{p.handle}</td>
                  <td>{p.order_id || "-"}</td>
                  <td style={{ color: p.error_handle ? "#C43E1C" : "inherit" }}>
                    {p.error_handle || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
