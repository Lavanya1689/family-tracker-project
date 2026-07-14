import "./load-env";
import { ingestGmail } from "../lib/ingest-gmail";

ingestGmail(7)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
