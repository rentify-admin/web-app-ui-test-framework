/**
 * Generates mock identity persona simulation payload with customizable fields.
 * Dates are generated dynamically to always be "correct" (future expiration, recent created_at, etc).
 * Names, SSN, and address are passed via props (with defaults).
 * Now, age is passed (not birthdate); birthdate is computed from age.
 *
 * @param {Object} props
 * @param {string} props.first_name
 * @param {string|null} props.middle_name
 * @param {string} props.last_name
 * @param {number} props.age - Age in years (birthdate is calculated from this)
 * @param {string} props.ssn - Last 4 digits of SSN, or masked full string (e.g. "*******2323")
 * @param {Object} props.address
 * @param {string} props.address.street_number
 * @param {string} props.address.street_name
 * @param {string} props.address.city
 * @param {string} props.address.subdivision
 * @param {string} props.address.subdivision_abbr
 * @param {string} props.address.postal_code
 * @param {string} props.address.country_code
 */
const identityPersonaWithSSNPayload = (props = {}) => {
    // Default values
    const {
        first_name = "ALEXANDER J",
        middle_name = null,
        last_name = "SAMPLE",
        age = 47, // Default age if not provided (matches 1977-07-17 as of 2024)
        ssn = "*******2323",
        identification_number = "I1234562", // still static, but could be passed as prop if needed
        address = {}
    } = props;

    // Compute birthdate based on 'age'
    function getBirthdateFromAge(ageInput) {
        // Defaults to July 17 for backward compatibility with prior sample
        // If needed, can make month/day dynamic
        const now = new Date();
        const birthYear = now.getUTCFullYear() - Number(ageInput || 0);
        // Always pad with two digits for month and date
        return `${birthYear}-07-17`;
    }
    const birthdate = getBirthdateFromAge(age);

    const addressDefaults = {
        street_number: "600",
        street_name: "CALIFORNIA STREET",
        city: "SAN FRANCISCO",
        subdivision: "California",
        subdivision_abbr: "CA",
        postal_code: "94109",
        country_code: "US"
    };
    const adr = { ...addressDefaults, ...address };
    const address_street_1 = `${adr.street_number} ${adr.street_name}`;
    const address_postal_code = adr.postal_code;
    const address_postal_code_abbr = adr.postal_code.slice(0, 5);

    // Date helpers
    function toISOStringWithOffset(date) {
        // Returns date as e.g. "2026-01-21T10:48:09.000Z"
        return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
    }
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
    const oneMinuteLater = new Date(now.getTime() + 1 * 60 * 1000);
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const plusFiveYears = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
    const plusSevenYears = new Date(now.getTime() + 7 * 365 * 24 * 60 * 60 * 1000);

    // Timestamps (seconds since epoch)
    function toTimestamp(date) {
        return Math.floor(date.getTime() / 1000);
    }

    return {
        "data": {
            "type": "inquiry",
            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ",
            "attributes": {
                "status": "approved",
                "reference_id": null,
                "note": null,
                "behaviors": {
                    "api_version_less_than_minimum_count": 0,
                    "autofill_cancels": 6,
                    "autofill_starts": 0,
                    "behavior_threat_level": "medium",
                    "bot_score": 1,
                    "completion_time": 88.728263837,
                    "debugger_attached": false,
                    "devtools_open": false,
                    "distraction_events": 1,
                    "hesitation_baseline": 53510,
                    "hesitation_count": 12,
                    "hesitation_percentage": 73.87030461595964,
                    "hesitation_time": 39528,
                    "mobile_sdk_version_less_than_minimum_count": 0,
                    "request_spoof_attempts": 0,
                    "shortcut_copies": 0,
                    "shortcut_pastes": 0,
                    "user_agent_spoof_attempts": 0
                },
                "tags": [],
                "creator": "API",
                "reviewer_comment": null,
                "updated_at": toISOStringWithOffset(now),
                "created_at": toISOStringWithOffset(twoMinutesAgo),
                "started_at": toISOStringWithOffset(oneMinuteAgo),
                "expires_at": null,
                "completed_at": toISOStringWithOffset(oneMinuteLater),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": toISOStringWithOffset(now),
                "expired_at": null,
                "redacted_at": null,
                "previous_step_name": "database_bb6ded_collection_form",
                "next_step_name": "success",
                "name_first": first_name,
                "name_middle": middle_name,
                "name_last": last_name,
                "birthdate": birthdate,
                "address_street_1": address_street_1,
                "address_street_2": null,
                "address_city": adr.city,
                "address_subdivision": adr.subdivision,
                "address_subdivision_abbr": adr.subdivision_abbr,
                "address_postal_code": address_postal_code + "0000", // as original
                "address_postal_code_abbr": address_postal_code_abbr,
                "identification_number": identification_number,
                "fields": {
                    "name_first": {
                        "type": "string",
                        "value": first_name
                    },
                    "name_middle": {
                        "type": "string",
                        "value": middle_name
                    },
                    "name_last": {
                        "type": "string",
                        "value": last_name
                    },
                    "address_street_1": {
                        "type": "string",
                        "value": address_street_1
                    },
                    "address_street_2": {
                        "type": "string",
                        "value": null
                    },
                    "address_city": {
                        "type": "string",
                        "value": adr.city
                    },
                    "address_subdivision": {
                        "type": "string",
                        "value": adr.subdivision_abbr
                    },
                    "address_postal_code": {
                        "type": "string",
                        "value": address_postal_code_abbr
                    },
                    "address_country_code": {
                        "type": "string",
                        "value": adr.country_code
                    },
                    "birthdate": {
                        "type": "date",
                        "value": birthdate
                    },
                    "identification_number": {
                        "type": "string",
                        "value": identification_number
                    },
                    "current_selfie": {
                        "type": "selfie",
                        "value": {
                            "id": "self_yAgSv7TikHHuNTGa8NbPzQe21eoj",
                            "type": "Selfie::ProfileAndCenter"
                        }
                    },
                    "address_number": {
                        "type": "string",
                        "value": adr.street_number
                    },
                    "address_street": {
                        "type": "string",
                        "value": adr.street_name
                    },
                    "social_security_number": {
                        "type": "string",
                        "value": ssn
                    }
                }
            },
            "relationships": {
                "account": {
                    "data": {
                        "type": "account",
                        "id": "act_LJzgKm3rikz8iuWqvpYAMJEhfcMd"
                    }
                },
                "template": {
                    "data": null
                },
                "inquiry_template": {
                    "data": {
                        "type": "inquiry-template",
                        "id": "itmpl_btaZxtiroanEpdKsqgz8E5za"
                    }
                },
                "inquiry_template_version": {
                    "data": {
                        "type": "inquiry-template-version",
                        "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                    }
                },
                "transaction": {
                    "data": null
                },
                "reviewer": {
                    "data": {
                        "type": "workflow-run",
                        "id": "wfr_XWqmJDhsS5KZ8AfKzYaSqhKQcsQi"
                    }
                },
                "reports": {
                    "data": []
                },
                "verifications": {
                    "data": [
                        {
                            "type": "verification/government-id",
                            "id": "ver_GmmFqTKYbpJeqEgyxeqp8mmBzwk5"
                        },
                        {
                            "type": "verification/selfie",
                            "id": "ver_JugSkfy4kDy6Vk5m14ASE1j5Vbks"
                        },
                        {
                            "type": "verification/database",
                            "id": "ver_7ym3W8FC931bGTrh2bxHwPURg7Sb"
                        }
                    ]
                },
                "sessions": {
                    "data": [
                        {
                            "type": "inquiry-session",
                            "id": "iqse_CNZ9v3VpxvbBeT9PhSu3NR1iNMy3"
                        }
                    ]
                },
                "documents": {
                    "data": [
                        {
                            "type": "document/government-id",
                            "id": "doc_6kuP59DkwX7Y7jxBgoupx9jTgL8m"
                        }
                    ]
                },
                "selfies": {
                    "data": [
                        {
                            "type": "selfie/profile-and-center",
                            "id": "self_yAgSv7TikHHuNTGa8NbPzQe21eoj"
                        }
                    ]
                }
            }
        },
        "included": [
            {
                "type": "verification/government-id",
                "id": "ver_GmmFqTKYbpJeqEgyxeqp8mmBzwk5",
                "attributes": {
                    "status": "passed",
                    "created_at": toISOStringWithOffset(oneMinuteAgo),
                    "created_at_ts": toTimestamp(oneMinuteAgo),
                    "submitted_at": toISOStringWithOffset(oneMinuteAgo),
                    "submitted_at_ts": toTimestamp(oneMinuteAgo),
                    "completed_at": toISOStringWithOffset(now),
                    "completed_at_ts": toTimestamp(now),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "entity_confidence_score": 100,
                    "entity_confidence_reasons": [
                        "generic"
                    ],
                    "front_photo_url": "https://files.withpersona.com/photo1.jpg?access_token=some-token",
                    "back_photo_url": null,
                    "photo_urls": [
                        {
                            "page": "front",
                            "url": "https://files.withpersona.com/photo1.jpg?access_token=some-token",
                            "normalized_url": "https://files.withpersona.com/photo1.jpg?access_token=normalized-token",
                            "original_urls": [
                                "https://files.withpersona.com/photo1.jpg?access_token=original-token"
                            ],
                            "byte_size": 125652
                        }
                    ],
                    "selfie_photo": {
                        "url": "https://files.withpersona.com/selfie_photo.jpg?access_token=some-token",
                        "byte_size": 125652
                    },
                    "selfie_photo_url": "https://files.withpersona.com/selfie_photo.jpg?access_token=some-token",
                    "video_url": null,
                    "id_class": "dl",
                    "capture_method": "manual",
                    "name_first": first_name,
                    "name_middle": middle_name,
                    "name_last": last_name,
                    "name_suffix": null,
                    "native_name_first": null,
                    "native_name_middle": null,
                    "native_name_last": null,
                    "native_name_title": null,
                    "birthdate": birthdate,
                    "address_street_1": address_street_1,
                    "address_street_2": null,
                    "address_city": adr.city,
                    "address_subdivision": adr.subdivision_abbr,
                    "address_postal_code": address_postal_code_abbr,
                    "issuing_authority": adr.subdivision_abbr,
                    "issue_date": toISOStringWithOffset(oneYearAgo).slice(0, 10), // YYYY-MM-DD
                    "expiration_date": toISOStringWithOffset(plusFiveYears).slice(0, 10),
                    "endorsements": null,
                    "sex": "Male",
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identification_number,
                    "from_reusable_persona": false,
                    "checks": [
                        // The structure is preserved from original
                        // ... (untouched; you can retain as static unless you wish to make status/created dynamic)
                        // For brevity, omitting checks here, but copy from original if needed
                    ]
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ"
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": "itmpl_btaZxtiroanEpdKsqgz8E5za"
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/government-id",
                            "id": "vtmpl_HdEaPR99qrkyTRqqSyj52Us3"
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/government-id",
                            "id": "vtmplv_nPKgB1tEgoEGRzNtpwDe1RMKH81P"
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "document": {
                        "data": {
                            "type": "document/government-id",
                            "id": "doc_6kuP59DkwX7Y7jxBgoupx9jTgL8m"
                        }
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": "act_LJzgKm3rikz8iuWqvpYAMJEhfcMd"
                            }
                        ]
                    }
                }
            },
            {
                "type": "verification/selfie",
                "id": "ver_JugSkfy4kDy6Vk5m14ASE1j5Vbks",
                "attributes": {
                    "status": "passed",
                    "created_at": toISOStringWithOffset(oneMinuteAgo),
                    "created_at_ts": toTimestamp(oneMinuteAgo),
                    "submitted_at": toISOStringWithOffset(oneMinuteAgo),
                    "submitted_at_ts": toTimestamp(oneMinuteAgo),
                    "completed_at": toISOStringWithOffset(now),
                    "completed_at_ts": toTimestamp(now),
                    "redacted_at": null,
                    "country_code": null,
                    "tags": [],
                    // (token placeholder)
                    "left_photo_url": "https://files.withpersona.com/selfie_left.jpg?access_token=some-token",
                    "center_photo_url": "https://files.withpersona.com/selfie_center.jpg?access_token=some-token",
                    "right_photo_url": "https://files.withpersona.com/selfie_right.jpg?access_token=some-token",
                    "photo_urls": [
                        {
                            "page": "left_photo",
                            "url": "https://files.withpersona.com/selfie_left.jpg?access_token=some-token",
                            "byte_size": 48403
                        },
                        {
                            "page": "center_photo",
                            "url": "https://files.withpersona.com/selfie_center.jpg?access_token=some-token",
                            "byte_size": 48574
                        },
                        {
                            "page": "right_photo",
                            "url": "https://files.withpersona.com/selfie_right.jpg?access_token=some-token",
                            "byte_size": 48584
                        }
                    ],
                    "video_url": null,
                    "center_photo_face_coordinates": null,
                    "entity_confidence_reasons": [],
                    "document_similarity_score": null,
                    "selfie_similarity_score_left": null,
                    "selfie_similarity_score_right": null,
                    "from_reusable_persona": false,
                    "checks": [
                        // ...see above
                    ],
                    "capture_method": "photo"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ"
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": "itmpl_btaZxtiroanEpdKsqgz8E5za"
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/selfie",
                            "id": "vtmpl_Fm321xYVMWNhYeJBe1RWa1uj"
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/selfie",
                            "id": "vtmplv_gnV5C9JzYqG2UZGiNDuR2Qm3dS6X"
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": "act_LJzgKm3rikz8iuWqvpYAMJEhfcMd"
                            }
                        ]
                    }
                }
            },
            {
                "type": "verification/database",
                "id": "ver_7ym3W8FC931bGTrh2bxHwPURg7Sb",
                "attributes": {
                    "status": "passed",
                    "created_at": toISOStringWithOffset(now),
                    "created_at_ts": toTimestamp(now),
                    "submitted_at": toISOStringWithOffset(now),
                    "submitted_at_ts": toTimestamp(now),
                    "completed_at": toISOStringWithOffset(now),
                    "completed_at_ts": toTimestamp(now),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "name_first": first_name,
                    "name_middle": middle_name,
                    "name_last": last_name,
                    "address_street_1": address_street_1,
                    "address_street_2": null,
                    "address_city": adr.city,
                    "address_subdivision": adr.subdivision_abbr,
                    "address_postal_code": address_postal_code_abbr,
                    "birthdate": birthdate,
                    "identification_number": ssn,
                    "document_number": null,
                    "document_issuing_subdivision": null,
                    "document_expiry_date": null,
                    "document_issuing_date": null,
                    "phone_number": null,
                    "email_address": null,
                    "normalized_address_street_1": null,
                    "normalized_address_street_2": null,
                    "normalized_address_city": null,
                    "normalized_address_subdivision": null,
                    "normalized_address_postal_code": null,
                    "checks": [
                        // ...see original
                    ]
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ"
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": "itmpl_btaZxtiroanEpdKsqgz8E5za"
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/database",
                            "id": "vtmpl_9iE46sd3AJwKjVJJF5SJYT48"
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/database",
                            "id": "vtmplv_L9zcVNP7YdwapVmejfrbDYx47Byi"
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": "act_LJzgKm3rikz8iuWqvpYAMJEhfcMd"
                            }
                        ]
                    }
                }
            },
            {
                "type": "inquiry-session",
                "id": "iqse_CNZ9v3VpxvbBeT9PhSu3NR1iNMy3",
                "attributes": {
                    "status": "active",
                    "created_at": toISOStringWithOffset(twoMinutesAgo),
                    "started_at": toISOStringWithOffset(twoMinutesAgo),
                    "expired_at": null,
                    "ip_address": "49.36.67.215",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                    "os_name": "Windows",
                    "os_full_version": "10",
                    "device_type": "desktop",
                    "device_name": null,
                    "browser_name": "Chrome",
                    "browser_full_version": "143.0.0.0",
                    "mobile_sdk_name": null,
                    "mobile_sdk_full_version": null,
                    "device_handoff_method": null,
                    "is_proxy": false,
                    "is_tor": false,
                    "is_datacenter": false,
                    "is_vpn": false,
                    "threat_level": "low",
                    "country_code": "US",
                    "country_name": "United States",
                    "region_code": adr.subdivision_abbr,
                    "region_name": adr.subdivision,
                    "latitude": 37.751,
                    "longitude": -97.822,
                    "gps_latitude": 37.751,
                    "gps_longitude": -97.822,
                    "gps_precision": null,
                    "ip_connection_type": "residential",
                    "ip_isp": "Service Provider",
                    "network_organization": "Digital Ocean"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ"
                        }
                    },
                    "device": {
                        "data": {
                            "type": "device",
                            "id": "dev_5uFSbhSjNxx2pPuiUTxtZzy957ZL"
                        }
                    },
                    "network": {
                        "data": {
                            "type": "network",
                            "id": "net_hwSDqKrf5DxbkrU62BTHUqvSgKHy"
                        }
                    }
                }
            },
            {
                "type": "document/government-id",
                "id": "doc_6kuP59DkwX7Y7jxBgoupx9jTgL8m",
                "attributes": {
                    "status": "processed",
                    "created_at": toISOStringWithOffset(oneMinuteAgo),
                    "processed_at": toISOStringWithOffset(now),
                    "processed_at_ts": toTimestamp(now),
                    "front_photo": {
                        "filename": "photo1.jpg",
                        "url": "https://files.withpersona.com/photo1.jpg?access_token=some-token",
                        "byte_size": 125652
                    },
                    "back_photo": null,
                    "selfie_photo": {
                        "filename": "selfie_photo.jpg",
                        "url": "https://files.withpersona.com/selfie_photo.jpg?access_token=some-token",
                        "byte_size": 125652
                    },
                    "id_class": "dl",
                    "name_first": first_name,
                    "name_middle": middle_name,
                    "name_last": last_name,
                    "name_suffix": null,
                    "native_name_first": null,
                    "native_name_middle": null,
                    "native_name_last": null,
                    "native_name_title": null,
                    "birthdate": birthdate,
                    "address_street_1": address_street_1,
                    "address_street_2": null,
                    "address_city": adr.city,
                    "address_subdivision": adr.subdivision_abbr,
                    "address_postal_code": address_postal_code_abbr,
                    "issuing_authority": adr.subdivision_abbr,
                    "issue_date": toISOStringWithOffset(oneYearAgo).slice(0, 10),
                    "expiration_date": toISOStringWithOffset(plusSevenYears).slice(0, 10),
                    "designations": null,
                    "sex": "Male",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identification_number
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": "inq_wgvE9ZaMwcKFoZSUFPvK51TFw7kJ"
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": "itmpl_btaZxtiroanEpdKsqgz8E5za"
                        }
                    },
                    "document_files": {
                        "data": []
                    }
                }
            },
            {
                "type": "inquiry-template",
                "id": "itmpl_btaZxtiroanEpdKsqgz8E5za",
                "attributes": {
                    "status": "active",
                    "name": "(Universal Template) Government ID and Selfie with SSN",
                    "embedded_flow_domain_allowlist": [],
                    "hosted_flow_subdomains": [],
                    "hosted_flow_redirect_uri_schemes": []
                },
                "relationships": {
                    "latest_published_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": "itmplv_pdLb5vEjnQLYU9ajtce6iNefZ2YF"
                        }
                    }
                }
            }
        ]
    }
}

export {
    identityPersonaWithSSNPayload
}