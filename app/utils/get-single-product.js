import axios from 'axios';

export const getSingleProduct = async (session, product_id, order_id) => {
  const shopDomain = session.shop;
  const accessToken = session.accessToken;

  const productUrl = `https://${shopDomain}/admin/api/2025-04/products/${product_id}.json`;
  const metafieldsUrl = `https://${shopDomain}/admin/api/2025-04/products/${product_id}/metafields.json`;

  try {
    // 1. Fetch the product
    const productResponse = await axios.get(productUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    if (!productResponse?.data?.product) {
      throw new Error(`Product with ID ${product_id} not found`);
    }

    // 2. Fetch the metafields
    const metafieldsResponse = await axios.get(metafieldsUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    const metafields = metafieldsResponse.data.metafields || [];

    const rauOrderIdMetafield = metafields.find(mf => mf.key === 'rau_order_id');
    const uploadStatusMetafield = metafields.find(mf => mf.key === 'rau_uploadstatus');
    const progressMetafield = metafields.find(mf => mf.key === 'rau_progress');
    const authenticateMetafield = metafields.find(mf => mf.key === 'rau_authenticationstatus');

    const headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };

    // Helper function to create a metafield
    const createMetafield = async (key, value) => {
      const response = await axios.post(
        `https://${shopDomain}/admin/api/2025-04/products/${product_id}/metafields.json`,
        {
          metafield: {
            namespace: 'custom',
            key,
            value,
            type: 'single_line_text_field',
          },
        },
        { headers }
      );
      return response.data.metafield;
    };

    // Helper function to update a metafield
    const updateMetafield = async (id, value) => {
      const response = await axios.put(
        `https://${shopDomain}/admin/api/2025-04/metafields/${id}.json`,
        {
          metafield: {
            id,
            value,
            type: 'single_line_text_field',
          },
        },
        { headers }
      );
      return response.data.metafield;
    };

    const results = {};

    // 3. rau_order_id metafield
    if (!rauOrderIdMetafield) {
      console.warn(`Metafield 'rau_order_id' not found for product ${product_id}, creating it...`);
      results.rau_order_id = await createMetafield('rau_order_id', String(order_id));
    } else {
      results.rau_order_id = await updateMetafield(rauOrderIdMetafield.id, String(order_id));
    }

    // 4. rau_uploadstatus metafield
    if (!uploadStatusMetafield) {
      console.warn(`Metafield 'rau_uploadstatus' not found, creating it...`);
      results.rau_uploadstatus = await createMetafield('rau_uploadstatus', 'Uploaded');
    } else {
      results.rau_uploadstatus = await updateMetafield(uploadStatusMetafield.id, 'Uploaded');
    }

    // 5. rau_progress metafield
    if (!progressMetafield) {
      console.warn(`Metafield 'rau_progress' not found, creating it...`);
      results.rau_progress = await createMetafield('rau_progress', 'In Progress');
    } else {
      results.rau_progress = await updateMetafield(progressMetafield.id, 'In Progress');
    }

    // 5. rau_progress metafield
    if (!authenticateMetafield) {
      console.warn(`Metafield 'authentic' not found, creating it...`);
      results.rau_progress = await createMetafield('rau_authenticationstatus', 'authentic');
    } else {
      results.rau_progress = await updateMetafield(authenticateMetafield.id, 'authentic');
    }

    return {
      product: productResponse.data.product,
      metafields: results,
    };

  } catch (error) {
    console.error(`Error in getSingleProduct:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch or update product ${product_id}: ${error.message}`);
  }
};
