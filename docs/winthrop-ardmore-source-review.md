# Winthrop and Ardmore source review

Reviewed 2026-10-27. These are source inferences, not field-verified motor movements. GeographicLib WGS84 lengths below sum the saved city centerlines; they are designation lengths, not continuous driving distances.

## Designation and junction implications

- **WINTHROP**, north–south: one assembled component, 2.141 miles. The city rows cover Leland–Argyle (0.418 mi), Argyle–Ardmore (0.969), and Ardmore–Sheridan (0.754). All say motor and bicycle southbound. This does not establish that every southbound approach-to-departure movement is legal or connected.
- **ARDMORE**, west–east: one assembled component, 0.303 miles. Broadway–Winthrop is 0.106 mi with no cardinal motor direction in the city row; Winthrop–Sheridan is 0.146 mi with `oneway_dir=E`, two-way bicycle and `contraflow=Y`; Sheridan–Lakefront Trail is 0.051 mi with no cardinal motor direction. Missing direction is not positive proof of two-way car access. The opposite-direction bicycle accommodation is not permission for westbound cars. The designated endpoint at the trail is not a car connection.

Source: [saved Chicago bicycle routes query](https://data.cityofchicago.org/resource/hvv9-38ut.json), retrieved 2026-09-19; see `data/sources/greenways.json` for row IDs and attributes. Check Sheridan and Winthrop turns and any barriers separately, rather than joining street designations into an assumed route.

## CDOT and ward chronology

- CDOT's [2014 year-end review](https://chicagocompletestreets.org/wp-content/uploads/2013/06/YearEndReview_2014_Draft_Jan27th_WEB.pdf), printed p. 15 (PDF page 18), shows markings described as guiding cyclists on Winthrop and Ardmore to the Lakefront Trail. Printed p. 18 (PDF page 21) lists Winthrop from Ardmore to Sheridan as a restriped bike lane and Ardmore from Winthrop to the trail as restriped marked shared lanes. This is historical project documentation, not an intersection engineering plan or evidence of present-day motor permissions.
- The [48th Ward infrastructure town hall](https://the-48th-ward.squarespace.com/blog/infrastructure-town-hall-august-14-2024), August 14, 2024, describes planned Winthrop/Kenmore wayfinding signs and markings and embeds a plan image. The [embedded image](https://images.squarespace-cdn.com/content/v1/6440662e14e59b3037e72c3c/94431fa7-293b-4d9e-ad6a-45abd4b5e9fc/Newsletter%2BPhoto%2BEditor%2B%282%29.jpg) was visually inspected in Safari: it shows a cropped intersection drawing with crosswalks, green bicycle markings and a one-way-except-bikes symbol, alongside an example Lakefront Trail wayfinding sign. The crop has no legible street names, so its intersection and motor turns cannot be attributed confidently; it is not an as-built drawing.
- The ward's [September 11, 2024 construction update](https://the48thward.org/blog/construction-updates-september-11-2024) reports the Winthrop/Kenmore work underway, not completed. It separately lists the temporary CTA restoration closure of Ardmore Broadway–Winthrop through September 21, 2024; that is not evidence of a permanent barrier.
- The [ward's Sheridan safety summary](https://the48thward.org/blog/sheridan-pedestrian-safety), October 2, 2026, describes existing Winthrop/Kenmore and Ardmore routes and reports a decorative crosswalk at Ardmore/Sheridan installed in 2025. It does not determine car turn permissions or prove the entire route is passable.

## Outstanding evidence

No original CDOT intersection-scale design or signed as-built drawing for these corridors was located in this search. Obtain the original drawings and construction records, inspect current one-way and turn signage, compare node-level barriers and OSM restrictions at each junction, and confirm post-CTA construction geometry. The 2024 plan image and project-wide reports are insufficient to classify any specific car movement as field-verified.

## Goudy school gates and the Winthrop gap

The 48th Ward's [May 19, 2026 recap](https://the48thward.org/blog/ward-night-may-19-2026) reports newly installed gates on Goudy Elementary's east side that cut off through traffic on Winthrop between Winona and Foster **when closed**; it suggests alternate routes for cyclists and pedestrians. The [June 17 recap](https://the48thward.org/blog/ward-night-june-16-2026) repeats this account. This overlaps the approximately 83 m unmatched Winthrop segment at latitude 41.975246–41.975996, but the notices do not precisely locate the gates, establish a schedule, or verify current status. Treat the gap as unknown until surveyed; do not equate unmatched length to the physical gate location.

CTA's [RPM construction page](https://www.transitchicago.com/rpm/) lists October 12, 2026 curb work and no through traffic **in the alley** west of Winthrop between Foster and Berwyn. Its effect on that alley does not establish a Winthrop roadway closure. Earlier CTA Foster construction and the September 2024 Ardmore road closure had dated, temporary scopes and do not establish current conditions.

SHA-256 of the retrieved CDOT 2014 PDF: `7515bf959b73b956ceb967351c7e299cbb3668a53d35f9c770eb72e00d93ced6`. SHA-256 of the ward plan image: `c41cf40107276dc08f05a8705b69904fead140eea9f685df97e07c510f8b83c9`.
