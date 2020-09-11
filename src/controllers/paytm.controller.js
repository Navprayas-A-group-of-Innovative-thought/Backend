const https = require("https");
const qs = require("querystring");
const checksum = require("../helpers/paytm/checksum");
const { response } = require("express");
const User = require("../model/users.model");
const jwt = require("jsonwebtoken")
const Form = require('../model/userForm.model')

exports.paytmController = (req, res) => {
  const token = req.headers.authorization.split(" "); // extracting token from header
  const { _id } = jwt.decode(token[1]);
  User.findOne({ _id }).exec((err, user) => {
    if (err || !user) {
      // if user not found
      return res.status(404).json({
        errorDetails: "User doesn't exist.",
      });
    } else {
      if (!req.query.formId || !req.query.amt) {
        return res.status(400).json("Missing Form ID or Amount");
      } else {
        var email = user.email;
        var mobile_no = user.profile.contact;
        var paytmParams = {
          MID: process.env.TEST_MERCHANT_ID,
          WEBSITE: process.env.WEBSITE,
          INDUSTRY_TYPE_ID: process.env.INDUSTRY_TYPE,
          CHANNEL_ID: process.env.CHANNEL_ID,
          ORDER_ID: "NP" + req.query.formId + new Date().getTime(),
          CUST_ID: "abcdef",
          MOBILE_NO: mobile_no.toString(),
          EMAIL: email,
          TXN_AMOUNT: req.query.amt,
          CALLBACK_URL: process.env.CALLBACK_URL,
        };

        checksum.genchecksum(
          paytmParams,
          process.env.TEST_MERCHANT_KEY,
          (err, checksum) => {
            var txn_url =
              "https://securegw-stage.paytm.in/theia/processTransaction";
            var form_fields = "";
            for (var x in paytmParams) {
              form_fields +=
                "<input type='hidden' name='" +
                x +
                "' value='" +
                paytmParams[x] +
                "' >";
            }
            form_fields +=
              "<input type='hidden' name='CHECKSUMHASH' value='" +
              checksum +
              "' >";

            res.writeHead(200, { "Content-Type": "text/html" });
            res.write(
              '<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' +
                txn_url +
                '" name="f1">' +
                form_fields +
                '</form><script type="text/javascript">document.f1.submit();</script></body></html>'
            );
            res.end();
          }
        );
      }
    }
  });
};

exports.callbackController = (req, res) => {
  var body = "";
  console.log('calllllllll')
  req.on("data", function (data) {
    body += data;
  });

  req.on("end", function () {
    var html = "";
    var post_data = qs.parse(body);

    // verify the checksum
    var checksumhash = post_data.CHECKSUMHASH;
    // delete post_data.CHECKSUMHASH;
    var result = checksum.verifychecksum(
      post_data,
      process.env.TEST_MERCHANT_KEY,
      checksumhash
    );

    // Send Server-to-Server request to verify Order Status
    var params = {
      MID: process.env.TEST_MERCHANT_ID,
      ORDERID: post_data.ORDERID,
    };

    checksum.genchecksum(params, process.env.TEST_MERCHANT_KEY, function (
      err,
      checksum
    ) {
      params.CHECKSUMHASH = checksum;
      post_data = "JsonData=" + JSON.stringify(params);

      var options = {
        hostname: "securegw-stage.paytm.in", // for staging
        // hostname: 'securegw.paytm.in', // for production
        port: 443,
        path: "/merchant-status/getTxnStatus",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": post_data.length,
        },
      };

      // Set up the request
      var response = "";
      var post_req = https.request(options, function (post_res) {
        post_res.on("data", function (chunk) {
          response += chunk;
        });

        post_res.on("end", function () {
          var _result = JSON.parse(response);
          if (_result["RESPCODE"] == "01") {
            res.json({ responseData: _result["RESPMSG"] });

            console.log(_result);
          } else {
            res
              .status(_result["RESPCODE"])
              .json({ errorDetails: _result["RESPMSG"] });
          }
        });
      });

      // post the data
      post_req.write(post_data);
      post_req.end();
    });
  });
};
