### This downhill integration is triggered by the “start installation” button… the idea is to do all of this within our wizard instead of using zapier.

1. Zapier Receives payload from wizared that includes the client name, imei, sim iccid, vin number, installation id, and secondary imei (in case there’s a secondary device)  
2. Zapier then checks its tables for a specific file called ‘repeats’ where we will see now how it fills up (see step 4\)   
3. Zapier runs a filter that stops the zap is the current installation id was found in the repeats table  
4. Zapier creates a table record of the current installation id in the repeats table file previously mentioned  
5. \[MIGHT DEPRECATE\] First request to pegasus is made  
   1. This request might be unnecessary  
      1. type : GET  
      2. URL: [https://qservices.pegasusgateway.com/installations/api/v1/](https://qservices.pegasusgateway.com/installations/api/v1/)  
      3. Data: {\`"NumREQ": ":installationID from step 1"}  
      4. Content-type: application/json  
      5. Authorization: Basic UTJLc2VZYXVxSFFZWDdjUzpoOUFmQU16YkFNQTJuZThT  
6. Zapier updates a spreadsheet in the following manner (a) and it does (b)  
   1. parameters:  
      1. Spreadsheet name: Mass Commands DI-361  
      2. Worksheet: Groups  
      3. Row: 2  
      4. Group Name: ‘Client Name’ from step 1  
   2. Spreadsheet:  
      1. We update the ‘Groups’ sheet specifically column B ‘Group Name’ and column I ‘Company Country’  
      2. Then over in the ‘cURL Groups’ sheet the row2 entry column Curl has the following formula: \=IF(ISBLANK(Groups\!B2),"","curl \-X POST 'https://api.pegasusgateway.com/groups?auth="2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824" \-H 'Content-Type: application/json' \-d '{""name"":"""\&Groups\!B2&""",""company\_name"":"""\&Groups\!C2&""",""address\_1"":"""\&Groups\!D2&""",""logo"":null,""contact\_email"":"""\&Groups\!K2&""",""contact\_name"":"""\&Groups\!J2&""",""city"":"""\&Groups\!F2&""",""country"":"""\&Groups\!I2&"""}'")  
7. Zapier looks up a spreadsheet row  
   1. Parameters:  
      1. Spreadsheet name: Mass Commands DI-361  
      2. Worksheet: cURL Groups  
      3. Lookup column: Curl  
      4. Lookup value: key\<Row from step 6\>   
         1. Which in this case would be row 2  
8. Zapier step to break up the curl we generated in excel using the ‘ as a delimiter  
9. Second request to pegasus is made  
   1. The point of this request is to create a group in pegasus  
      1. Type: POST  
      2. URL: the chunk from step 8 that looks like this: https://api.pegasusgateway.com/groups?auth=2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
      3. Data:  the chunk from step 8 output that look like this: {"name":"OLGA MEDRANO GARCIA","company\_name":"","address\_1":"","logo":null,"contact\_email":"","contact\_name":"","city":"","country":"Mexico"}  
      4. Headers: content-type: application.json  
10. Zapier clears rows 2-50 of the “Vehicles” worksheet within the Mass Commands DI-361 spreadsheet (we are going to use this worksheet in later steps  
11. \[MIGHT DEPRECATE\] A third request to pegasus is made  
    1. The point of this request is to make sure that the device imei is in pegasus \[might be redundant\] if not it creates it  
       1. Type: POST  
       2. URL: [https://api.pegasusgateway.com/devices](https://api.pegasusgateway.com/devices)  
       3. Data: {"imei": :imei from step 1}  
       4. Headers:   
          1. Authenticate: 2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
          2. Content-type: application/json  
12. Now zapier breaks into two paths: main path, secondary device add-on  
13. Main path condition: always run  
14. Zapier updates the the spreadsheet rows  
    1. Parameters  
       1. Spreadsheet name: mass commands di-361  
       2. Worksheet: vehicles  
       3. Row \#2  
       4. Columns  
          1. Col a: vin from step 1  
          2. Col c: imei from step 1  
          3. Col i: vin from step 1  
          4. Col m: ID from step 9  
15. Now zapier can lookup the spreadsheet row 2 from the sheet ‘cURL Vehicles’ which has the following formula:

```
=IF(ISBLANK(Vehicles!A2),"",
  "curl -X POST 'https://api.pegasusgateway.com/vehicles?auth="&Instructions!$C$1&"'"&
  " -H 'Content-Type: application/json' -d '{""name"":"""&Vehicles!A2&""","&
  IF(ISBLANK(Vehicles!C2), """device"":null", """device"":"""&Vehicles!C2&"""")&","&
  """year"":"""&Vehicles!D2&""",""make"":"""&Vehicles!E2&""",""model"":"""&Vehicles!F2&""","&
  """license_plate"":"""&Vehicles!G2&""",""color"":"""&Vehicles!H2&""",""vin"":"""&Vehicles!I2&""","&
  IF(ISBLANK(Vehicles!J2), """tank_volume"":null", """tank_volume"":"&Vehicles!J2&"")&","&
  IF(ISBLANK(Vehicles!K2), """tank_unit"":null", """tank_unit"":"""&Vehicles!K2&"""")&","&
  """groups"":["&Vehicles!M2&",3367]"&
  IF(ISBLANK(Vehicles!L2), "", ",""properties"":{""policy_number"":"""&Vehicles!L2&"""}")&
  "}'"
)
```

    1. THIS WILL RESULT IN THE FOLLOWING EXAMPLE:

```
curl -X POST 'https://api.pegasusgateway.com/vehicles?auth=2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824' -H 'Content-Type: application/json' -d '{"name":"1GKS27KL1RR148321","device":"869671075556876","year":"","make":"","model":"","license_plate":"","color":"","vin":"1GKS27KL1RR148321","tank_volume":null,"tank_unit":null,"groups":[17326,3367]}'
```

16. Zapier will use the ‘ delimiter to split that up into chunks digestible by zapier to send the next post request to pegasus  
17. We split   
18. Fourth request to pegasus is made  
    1. Type: POST  
    2. URL: https://api.pegasusgateway.com/vehicles?auth=2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
    3. DATA: {"name":"1GKS27KL1RR148321","device":"869671075556876","year":"","make":"","model":"","license\_plate":"","color":"","vin":"1GKS27KL1RR148321","tank\_volume":null,"tank\_unit":null,"groups":\[17326,3367\]}  
19. We use a regex pattern \\d{4} to grab the first four digits of sim number from step 1  
    1. This allows us to determine whether its a super or a wireless  
20. Split into paths for wireless and sim  
21. Path condition if the output from step 19 exactly matches ‘8901’ which is always the first four digits of a wireless sim  
22. A fifth request to pegasus is made   
    1. Parameters   
       1. Type: GET  
       2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=:sim](https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=:sim) number from step 1  
       3. Headers  
          1. Authenticate: 2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
    2. Result:

```
sims
1
Sims Sid
DE0a4576771276b0a285d8cfe49af2520f
Sims Friendly Name
Sims Unique Name
Test Jesus
Sims Account Sid
AC5e3bed6b465b3f2a60b2cf4f21474e5a
Sims Status
active
Sims Rate Plan Sid
WP0958cd0552401081a17cc824ce7aadf2
Sims Iccid
8901260862393323067
Sims E Id
Sims Commands Callback Url
Sims Commands Callback Method
POST
Sims Date Created
2019-12-05T06:01:17Z
Sims Date Updated
2025-06-26T16:51:45Z

```

23. We split paths again for sims that are already migrated to pegasus site 256 or if they are still in the warehouse (pegasus site 1\)  
24. Path conditions for sim being in pegasus1.   
    1. By seeing if sim iccid DNE from step 22 because that request is made using the bearer token for peg256. Which would by default mean that the sim is in pegasus1  
25. A sixth request to pegasus is made  
    1. Type: POST  
    2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims](https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims) sid from step 22  
26. Path conditions for sim being already migrated in pegasus256  
    1. By seeing if sim iccid EXISTS from step 22 because that request is made using the bearer token for peg256. It would mean its already migrated  
27. An alternative sixth request to pegasus  
    1. Type: POST  
    2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims](https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims) Sid from step 22  
    3. Data: {"Status": "active"}  
    4. Headers:   
       1. Authenticate: 2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
       2. Content-Type: application/json  
28. Path condition if the output from step 19 exactly matches ‘8988’ which is always the first four digits of a super sim  
29. An alternative fifth request to pegasus is made   
    1. Parameters   
       1. Type: GET  
       2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=:sim](https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=:sim) number from step 1  
       3. Headers  
          1. Authenticate: 2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
    2. Result:

```
sims
1
Sims Sid
DE0a4576771276b0a285d8cfe49af2520f
Sims Friendly Name
Sims Unique Name
Test Jesus
Sims Account Sid
AC5e3bed6b465b3f2a60b2cf4f21474e5a
Sims Status
active
Sims Rate Plan Sid
WP0958cd0552401081a17cc824ce7aadf2
Sims Iccid
8901260862393323067
Sims E Id
Sims Commands Callback Url
Sims Commands Callback Method
POST
Sims Date Created
2019-12-05T06:01:17Z
Sims Date Updated
2025-06-26T16:51:45Z

```

30. We split paths again for sims that are already migrated to pegasus site 256 or if they are still in the warehouse (pegasus site 1\)  
31. Path conditions for sim being in pegasus1.   
    1. By seeing if sim iccid DNE from step 22 because that request is made using the bearer token for peg256. Which would by default mean that the sim is in pegasus1  
32. A sixth request to pegasus is made  
    1. Type: POST  
    2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims](https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims) sid from step 22  
33. Path conditions for sim being already migrated in pegasus256  
    1. By seeing if sim iccid EXISTS from step 22 because that request is made using the bearer token for peg256. It would mean its already migrated  
34. An alternative sixth request to pegasus  
    1. Type: POST  
    2. URL: [https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims](https://api.pegasusgateway.com/m2m/wireless/v1/Sims/:Sims) Sid from step 22  
    3. Data: {"Status": "active"}  
    4. Headers:   
       1. Authenticate: 2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824  
       2. Content-Type: application/json