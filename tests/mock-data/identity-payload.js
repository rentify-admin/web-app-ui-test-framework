import { generateUUID } from "../utils/helper";

const getDates = () => {
    const currentDate = new Date();

    const dateAfter2Years = new Date(currentDate);
    dateAfter2Years.setFullYear(currentDate.getFullYear() + 2);

    const dateBefore1Year = new Date(currentDate);
    dateBefore1Year.setFullYear(currentDate.getFullYear() - 1);

    const dateBefore20Years = new Date(currentDate);
    dateBefore20Years.setFullYear(currentDate.getFullYear() - 20);

    // FIXED: Now correctly subtracts minutes instead of setting to absolute value
    const subMinutes = (mins) => {
        const date = new Date(currentDate);
        date.setMinutes(currentDate.getMinutes() - mins);
        return date;
    };

    return {
        dateAfter2Years,
        dateBefore1Year,
        dateBefore20Years,
        currentDate,
        subMinutes
    };
};

function personaConnectData(userData = {}, userType = 'primary') {

    const {
        subMinutes,
        dateAfter2Years,
        dateBefore1Year,
        dateBefore20Years
    } = getDates();

    // Extract user data - USE ACTUAL VALUES from userData for name matching
    const firstName = userData.first_name || "Test";
    const lastName = userData.last_name || "User";
    const email = userData.email || "test@example.com";

    // Differentiate between Primary and Co-applicant/Guarantor
    const isGuarantor = userType === 'guarantor' || userType === 'co-applicant';
    const identificationNumber = isGuarantor ? "G7654321" : "I1234562";

    const inqId = generateUUID();
    const accId = generateUUID();
    const inqTempId = generateUUID();
    const inqTempVerId = generateUUID();
    const werRunId = generateUUID();
    const verGovId = generateUUID();
    const inqSessionId = generateUUID();
    const docId = generateUUID();
    const verTempVerId = generateUUID();
    const verTempId = generateUUID();
    const deviceId = generateUUID();
    const netId = generateUUID();

    return {
        "data": {
            "type": "inquiry",
            "id": inqId,
            "attributes": {
                "status": "approved",
                "reference_id": null,
                "note": null,
                "behaviors": {
                    "api_version_less_than_minimum_count": 0,
                    "autofill_cancels": 8,
                    "autofill_starts": 0,
                    "behavior_threat_level": "low",
                    "bot_score": 99,
                    "completion_time": 43.026355549,
                    "debugger_attached": false,
                    "devtools_open": true,
                    "distraction_events": 0,
                    "hesitation_baseline": 27224,
                    "hesitation_count": 6,
                    "hesitation_percentage": 97.35894798707024,
                    "hesitation_time": 26505,
                    "mobile_sdk_version_less_than_minimum_count": 0,
                    "request_spoof_attempts": 0,
                    "shortcut_copies": 0,
                    "shortcut_pastes": 0,
                    "user_agent_spoof_attempts": 0
                },
                "tags": [],
                "creator": "API",
                "reviewer_comment": null,
                "updated_at": subMinutes(5).toISOString(),
                "created_at": subMinutes(10).toISOString(), // FIXED: toISOString() instead of toDateString()
                "started_at": subMinutes(9).toISOString(),
                "expires_at": null,
                "completed_at": subMinutes(6).toISOString(),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": subMinutes(6).toISOString(),
                "expired_at": null,
                "redacted_at": null,
                "previous_step_name": "verification_government_id",
                "next_step_name": "success",
                "name_first": firstName, // DYNAMIC: Uses actual userData
                "name_middle": null, // FIXED: null instead of "Sample"
                "name_last": lastName, // DYNAMIC: Uses actual userData
                "birthdate": dateBefore20Years.toISOString().split('T')[0],
                "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                "address_street_2": null,
                "address_city": "BIRMINGHAM", // FIXED: Now has value
                "address_subdivision": "Alabama", // FIXED: Now has value
                "address_subdivision_abbr": "AL",
                "address_postal_code": "35201", // FIXED: Now has value
                "address_postal_code_abbr": "35201",
                "identification_number": identificationNumber,
                "fields": {
                    "name_first": {
                        "type": "string",
                        "value": firstName // DYNAMIC: Uses actual userData
                    },
                    "name_middle": {
                        "type": "string",
                        "value": null // FIXED: null instead of "Sample"
                    },
                    "name_last": {
                        "type": "string",
                        "value": lastName // DYNAMIC: Uses actual userData
                    },
                    "address_street_1": {
                        "type": "string",
                        "value": "123 TEST STREET BIRMINGHAM AL 35201"
                    },
                    "address_street_2": {
                        "type": "string",
                        "value": null
                    },
                    "address_city": {
                        "type": "string",
                        "value": "BIRMINGHAM" // FIXED: Now has value
                    },
                    "address_subdivision": {
                        "type": "string",
                        "value": "AL"
                    },
                    "address_postal_code": {
                        "type": "string",
                        "value": "35201" // FIXED: Now has value
                    },
                    "address_country_code": {
                        "type": "string",
                        "value": "US"
                    },
                    "birthdate": {
                        "type": "date",
                        "value": dateBefore20Years.toISOString().split('T')[0]
                    },
                    "identification_number": {
                        "type": "string",
                        "value": identificationNumber
                    }
                }
            },
            "relationships": {
                "account": {
                    "data": {
                        "type": "account",
                        "id": accId
                    }
                },
                "template": {
                    "data": null
                },
                "inquiry_template": {
                    "data": {
                        "type": "inquiry-template",
                        "id": inqTempId
                    }
                },
                "inquiry_template_version": {
                    "data": {
                        "type": "inquiry-template-version",
                        "id": inqTempVerId
                    }
                },
                "transaction": {
                    "data": null
                },
                "reviewer": {
                    "data": {
                        "type": "workflow-run",
                        "id": werRunId
                    }
                },
                "reports": {
                    "data": []
                },
                "verifications": {
                    "data": [
                        {
                            "type": "verification/government-id",
                            "id": verGovId
                        }
                    ]
                },
                "sessions": {
                    "data": [
                        {
                            "type": "inquiry-session",
                            "id": inqSessionId
                        }
                    ]
                },
                "documents": {
                    "data": [
                        {
                            "type": "document/government-id",
                            "id": docId
                        }
                    ]
                },
                "selfies": {
                    "data": []
                }
            }
        },
        "included": [
            {
                "type": "verification/government-id",
                "id": verGovId,
                "attributes": {
                    "status": "passed",
                    "created_at": subMinutes(10).toISOString(), // FIXED: toISOString() instead of toDateString()
                    "created_at_ts": Math.floor(subMinutes(10).getTime() / 1000), // FIXED: Math.floor instead of Math.ceil
                    "submitted_at": subMinutes(5).toISOString(),
                    "submitted_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "completed_at": subMinutes(5).toISOString(),
                    "completed_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "entity_confidence_score": 100,
                    "entity_confidence_reasons": [
                        "generic"
                    ],
                    "front_photo_url": "https://files.withpersona.com/passport.jpg",
                    "back_photo_url": "https://files.withpersona.com/passport.jpg",
                    "photo_urls": [
                        {
                            "page": "front",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": [
                                "https://files.withpersona.com/passport.jpg"
                            ],
                            "byte_size": 143762
                        },
                        {
                            "page": "back",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": [
                                "https://files.withpersona.com/passport.jpg"
                            ],
                            "byte_size": 143762
                        }
                    ],
                    "selfie_photo": {
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 143762
                    },
                    "selfie_photo_url": "https://files.withpersona.com/selfie_photo.jpg",
                    "video_url": null,
                    "id_class": "dl",
                    "capture_method": "upload",
                    "name_first": firstName, // DYNAMIC: Uses actual userData
                    "name_middle": null, // FIXED: null instead of "Sample"
                    "name_last": lastName, // DYNAMIC: Uses actual userData
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                    "address_street_2": null,
                    "address_city": "BIRMINGHAM", // FIXED: Now has value
                    "address_subdivision": "AL",
                    "address_postal_code": "35201", // FIXED: Now has value
                    "issuing_authority": "AL", // FIXED: Now has value (was null)
                    "issue_date": dateBefore1Year.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "endorsements": null,
                    "sex": "Male",
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identificationNumber,
                    "from_reusable_persona": false,
                    "checks": [
                        {
                            "name": "id_aamva_database_lookup",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_account_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_attribute_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_blur_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_color_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_compromised_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_damaged_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_disallowed_country_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "selected_country_code": null
                            }
                        },
                        {
                            "name": "id_disallowed_type_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "detected_id_class": null,
                                "detected_id_designations": null,
                                "disallowed_id_designations": null,
                                "selected_id_classes": null
                            }
                        },
                        {
                            "name": "id_double_side_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_electronic_replica_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_entity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_experimental_model_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_expired_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_extracted_properties_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_extraction_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": {
                                "check_requirements": []
                            }
                        },
                        {
                            "name": "id_fabrication_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_glare_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_handwriting_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inconsistent_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inquiry_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_number_format_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_paper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_physical_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_po_box_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_clarity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_public_figure_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_real_id_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_selfie_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_unprocessable_submission_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_valid_dates_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_video_quality_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        }
                    ]
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/government-id",
                            "id": verTempId
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/government-id",
                            "id": verTempVerId
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "document": {
                        "data": {
                            "type": "document/government-id",
                            "id": docId
                        }
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": accId
                            }
                        ]
                    }
                }
            },
            {
                "type": "inquiry-session",
                "id": inqSessionId,
                "attributes": {
                    "status": "active",
                    "created_at": subMinutes(10).toISOString(),
                    "started_at": subMinutes(10).toISOString(),
                    "expired_at": null,
                    "ip_address": "52.201.131.218",
                    "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36",
                    "os_name": "GNU/Linux",
                    "os_full_version": null,
                    "device_type": "desktop",
                    "device_name": null,
                    "browser_name": "Chrome",
                    "browser_full_version": "114.0",
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
                    "region_code": "AL", // FIXED: Alabama instead of CA
                    "region_name": "Alabama", // FIXED: Alabama instead of California
                    "latitude": 33.521,
                    "longitude": -86.802,
                    "gps_latitude": 33.521,
                    "gps_longitude": -86.802,
                    "gps_precision": null,
                    "ip_connection_type": "residential",
                    "ip_isp": "Service Provider",
                    "network_organization": "Digital Ocean"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "device": {
                        "data": {
                            "type": "device",
                            "id": deviceId
                        }
                    },
                    "network": {
                        "data": {
                            "type": "network",
                            "id": netId
                        }
                    }
                }
            },
            {
                "type": "document/government-id",
                "id": docId,
                "attributes": {
                    "status": "processed",
                    "created_at": subMinutes(10).toISOString(),
                    "processed_at": subMinutes(5).toISOString(),
                    "processed_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "front_photo": {
                        "filename": "id_front.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 143762
                    },
                    "back_photo": {
                        "filename": "id_back.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 143762
                    },
                    "selfie_photo": {
                        "filename": "selfie_photo.jpg",
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 143762
                    },
                    "id_class": "dl",
                    "name_first": firstName, // DYNAMIC: Uses actual userData
                    "name_middle": null, // FIXED: null instead of "Sample"
                    "name_last": lastName, // DYNAMIC: Uses actual userData
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                    "address_street_2": null,
                    "address_city": "BIRMINGHAM", // FIXED: Now has value
                    "address_subdivision": "AL",
                    "address_postal_code": "35201", // FIXED: Now has value
                    "issuing_authority": "AL", // FIXED: Now has value (was null)
                    "issue_date": dateBefore1Year.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "designations": null,
                    "sex": "Male",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identificationNumber
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
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
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "document_files": {
                        "data": []
                    }
                }
            },
            {
                "type": "inquiry-template",
                "id": inqTempId,
                "attributes": {
                    "status": "active",
                    "name": "Government ID Front and Back (Offer Letter Test)",
                    "embedded_flow_domain_allowlist": [],
                    "hosted_flow_subdomains": [],
                    "hosted_flow_redirect_uri_schemes": []
                },
                "relationships": {
                    "latest_published_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    }
                }
            }
        ]
    };
}

/**
 * Check mode options for allChecksPersonaConnectData:
 *   'all_passed'       – every applicable check has status "passed" with empty reasons
 *   'partially_failed' – required checks (up to 3) are set to "failed" with reasons; others pass
 *   'all_failed'       – every applicable check has status "failed" with reasons
 *
 * Additional options:
 *   includeAamva (boolean, default true) – when false, the AAMVA verification block is omitted
 *     from the Persona payload entirely, simulating a session where AAMVA was not performed.
 *
 * Usage:
 *   allChecksPersonaConnectData(userData, 'primary', {
 *     governmentIdChecks: 'partially_failed',  // some required gov-id checks fail
 *     selfieChecks:       'all_passed',         // all selfie checks pass
 *     databaseChecks:     'all_passed',
 *     aamvaChecks:        'all_passed',
 *     includeAamva:       false,               // omit AAMVA section entirely
 *   })
 */
function allChecksPersonaConnectData(userData, userType = "primary", checkOptions = {}) {
    const {
        governmentIdChecks = 'all_passed',
        selfieChecks       = 'all_passed',
        databaseChecks     = 'all_passed',
        aamvaChecks        = 'all_passed',
        includeAamva       = true,
    } = checkOptions;

    // List of allowed reasons
    const allowedReasons = [
        "aamva_error", "external_service_error", "high_risk", "insufficient_match",
        "invalid_issuing_authority", "medium_risk", "missing_issuing_year", "name_first_insufficient_match",
        "name_last_insufficient_match", "skip_invalid_issuing_authority", "state_not_supported", "address_is_hc_box",
        "address_is_po_box", "age_below_limit", "back_missing", "barcode_not_decoded", "barcode_not_detected",
        "barcode_not_required", "camouflage_passport", "cannot_verify_id", "corrupt", "details_only_repeat",
        "digital_text_found", "disallowed_designation", "duration_too_short", "emulator_detected", "exif_inconsistency",
        "expected_paper_id_type", "expired", "fabricated_id_version", "face_mismatch", "failed_requirement",
        "federal_limits_apply", "federal_limits_undetected", "field_invalid", "format_invalid", "fraudulent",
        "holepunch_detected", "image_is_monochrome", "image_manipulated", "inconsistent_age", "inconsistent_details",
        "inconsistent_face", "incorrect_format", "insufficient_padding", "invalid_barcode", "invalid_checksum",
        "invalid_country", "invalid_encoded_data", "invalid_id_type", "issuer_invalid", "issuer_mismatch",
        "issuer_rules_inconsistency", "low_bit_rate", "low_frame_rate", "low_quality_portrait", "matched",
        "metadata_invalid", "missing_address", "missing_age_range", "missing_birthdate", "missing_face",
        "missing_issuing_date", "missing_properties", "mrz_checksum_invalid", "mrz_incomplete", "mrz_not_found",
        "mrz_not_verifiable", "name_partially_extracted", "names_swapped", "no_account", "no_barcode",
        "no_configuration", "no_country", "no_country_configuration", "no_expiration_date", "no_inquiry",
        "no_portrait", "no_required_properties", "no_selfie", "not_allowed_by_configuration", "not_enabled",
        "not_found", "paper_id_detected", "photocopy_found", "portrait_not_clear", "portrait_not_found",
        "portrait_tampering", "property_conflict", "property_mismatch", "property_not_extracted",
        "public_figure_detected", "publicly_available", "repeat", "replica_detected", "required_field_missing",
        "required_properties_absent_on_id", "restricted_type", "revision_invalid", "rooted_device", "sample_document",
        "screenshot_found", "selected_country_mismatch", "side_submitted_twice", "single_sided", "submission_invalid",
        "tamper_detected", "too_blurry", "too_much_glare", "type_mismatch", "type_not_detected", "unidentified",
        "unknown_date_rules", "unrestricted", "unsupported_comparison_language", "unsupported_country",
        "unsupported_document_type", "virtual_camera_detected", "age_above_limit", "age_mismatch", "age_outside_limits",
        "center_only", "center_pose_face_obscured", "comparison_attempt_unsuccessful", "deepfake_detected",
        "device_detected", "excessive_illumination", "eyes_closed", "face_conflict", "face_covering_detected",
        "face_cropped", "face_quality", "face_too_far", "gen_ai_detected", "glasses", "image_quality_low",
        "insufficient_detail", "insufficient_illumination", "invalid_pose", "multiple_faces_detected",
        "no_account_selfie_present", "no_age_limits", "no_comparison_inputs", "no_government_id",
        "no_reference_birthdate", "no_selfie_age", "no_selfie_age_estimation", "no_selfie_age_prediction",
        "pose_order_incorrect", "poses_repeated", "public_figure", "repeat_image", "replica_2d_detected",
        "required_poses_not_found", "sunglasses", "suspicious_photo", "unexpected_orientation", "disabled_by_check_config"
    ];

    // Mapping from check name to default plausible error reasons (usually based on a keyword match). 
    // You can extend this mapping to cover specific check names.
    const checkNameToSampleReason = (checkName) => {
        // AAMVA pattern matching
        if (checkName.startsWith('aamva_')) {
            if (checkName.includes('address')) return "address_is_po_box";
            if (checkName.includes('birthdate')) return "age_mismatch";
            if (checkName.includes('expiration')) return "expired";
            if (checkName.includes('identification_number')) return "invalid_id_type";
            if (checkName.includes('issue_date')) return "missing_issuing_date";
            if (checkName.includes('name')) return "name_first_insufficient_match";
            return "aamva_error";
        }
        // Government ID
        if (checkName.includes('barcode')) return "barcode_not_detected";
        if (checkName.includes('age')) return "age_mismatch";
        if (checkName.includes('expired')) return "expired";
        if (checkName.includes('mrz')) return "mrz_not_found";
        if (checkName.includes('po_box')) return "address_is_po_box";
        if (checkName.includes('tamper')) return "tamper_detected";
        if (checkName.includes('portrait')) return "portrait_not_clear";
        if (checkName.includes('fabrication')) return "fabricated_id_version";
        if (checkName.includes('glare')) return "too_much_glare";
        if (checkName.includes('color')) return "image_is_monochrome";
        if (checkName.includes('face')) return "face_mismatch";
        if (checkName.includes('compromised')) return "fraudulent";
        if (checkName.includes('inconsistent')) return "inconsistent_details";
        if (checkName.includes('physical_tamper')) return "tamper_detected";
        if (checkName.includes('double_side')) return "side_submitted_twice";
        if (checkName.includes('disallowed_country')) return "invalid_country";
        if (checkName.includes('disallowed_type')) return "restricted_type";
        if (checkName.includes('entity')) return "public_figure_detected";
        if (checkName.includes('selfie_comparison')) return "face_mismatch";
        if (checkName.includes('paper_detection')) return "paper_id_detected";
        // Selfie/Faces
        if (checkName.includes('multiple_faces')) return "multiple_faces_detected";
        if (checkName.includes('pose')) return "invalid_pose";
        if (checkName.includes('liveness')) return "suspicious_photo";
        if (checkName.includes('glasses')) return "glasses";
        if (checkName.includes('suspicious_entity')) return "suspicious_photo";
        if (checkName.includes('public_figure')) return "public_figure_detected";
        if (checkName.includes('face_covering')) return "face_covering_detected";
        if (checkName.includes('portrait_quality')) return "low_quality_portrait";        
        if (checkName.includes('image_quality')) return "image_quality_low";
        // Database
        if (checkName.includes('deceased')) return "not_found";
        if (checkName.includes('identity_comparison')) return "insufficient_match";
        if (checkName.includes('inquiry_comparison')) return "insufficient_match";
        // Default fallback
        return "disabled_by_check_config";
    };

    /**
     * Helper to get an array of plausible reasons (up to 4) for a failed check.
     * Will always use allowedReasons, and makes sure result is at most 4.
     */
    function getReasonsForCheck(checkName, usedReasonsSet) {
        // Always return a single item for this check, but try to avoid duplicates up to 4 for variety in 'all_failed' mode.
        const baseReason = checkNameToSampleReason(checkName);
        let result = [baseReason];

        // For 'all_failed' mode we may want more variety: pick additional from allowedReasons that contain parts of name, if available
        // Only include if we haven't already used them, max 4
        if (usedReasonsSet && usedReasonsSet.size < 4) {
            for (const reason of allowedReasons) {
                if (reason !== baseReason && reason.includes(checkName.replace(/_/g, "")) && !usedReasonsSet.has(reason)) {
                    result.push(reason);
                    if (result.length >= 4) break;
                }
            }
        }
        // If still less than 4, fill up (if desired) - for now we stick to 1 for clarity
        return result.slice(0, 4);
    }

    /**
     * Transforms a checks array according to the requested mode.
     * - 'not_applicable' statuses are always preserved as-is.
     * @param {Array}  checks  Original checks array
     * @param {string} mode    'all_passed' | 'partially_failed' | 'all_failed'
     */
    const applyMode = (checks, mode) => {
        switch (mode) {
            case 'all_passed':
                return checks.map(c =>
                    c.status === 'not_applicable'
                        ? c
                        : { ...c, status: 'passed', reasons: [] }
                );

            case 'all_failed':
                // Use up to 4 plausible reasons per check, mapped to check name; avoid duplicate reasons for variety
                return checks.map((c, i) =>
                    c.status === 'not_applicable'
                        ? c
                        : (() => {
                            const usedReasonsSet = new Set();
                            // Will always at least 1, but could be made up to 4 if variety needed
                            const reasons = getReasonsForCheck(c.name, usedReasonsSet);
                            // Clamp to allowedReasons
                            return { ...c, status: 'failed', reasons: reasons.filter(r => allowedReasons.includes(r)).slice(0, 4) };
                        })()
                );

            case 'partially_failed': {
                // Fail the first 3 required (and applicable) checks; pass everything else
                let failedCount = 0;
                return checks.map(c => {
                    if (
                        c.requirement === 'required' &&
                        c.status !== 'not_applicable' &&
                        failedCount < 3
                    ) {
                        failedCount++;
                        // Use 1 plausible reason matching this check
                        const reasons = getReasonsForCheck(c.name);
                        return { ...c, status: 'failed', reasons: reasons.filter(r => allowedReasons.includes(r)).slice(0, 4) };
                    }
                    return c.status === 'not_applicable'
                        ? c
                        : { ...c, status: 'passed', reasons: [] };
                });
            }

            default:
                return checks;
        }
    };

    // Utility for dynamic IDs
    const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    // Dynamic date helpers
    const now = new Date();
    const subMinutes = (n) => new Date(Date.now() - n * 60000);
    const dateBefore20Years = new Date(new Date().setFullYear(now.getFullYear() - 20));
    const dateBefore3Years = new Date(new Date().setFullYear(now.getFullYear() - 3));
    const dateAfter2Years = new Date(new Date().setFullYear(now.getFullYear() + 2));
    const todayString = () => (new Date()).toISOString().split('T')[0];

    // Extract user data - USE ACTUAL VALUES from userData for name matching
    const firstName = userData?.first_name || "Test";
    const lastName = userData?.last_name || "User";
    const email = userData?.email || "test@example.com";

    // Differentiate between Primary and Co-applicant/Guarantor
    const isGuarantor = userType === 'guarantor' || userType === 'co-applicant';
    const identificationNumber = isGuarantor ? "G" + uuid().slice(0, 7) : "I" + uuid().slice(0, 7);

    // Dynamic IDs for all entities
    const inqId = uuid();
    const accId = uuid();
    const inqTempId = uuid();
    const inqTempVerId = uuid();
    const werRunId = uuid();
    const verGovId = uuid();
    const inqSessionId = uuid();
    const verTempVerId = uuid();
    const verTempId = uuid();
    const deviceId = uuid();
    const netId = uuid();
    const documentGovernmentId = uuid();
    const verSelfieId = uuid();
    const verTmpSelfieId = uuid();
    const verDbId = uuid();
    const selfieProfileAndCenterId = uuid();
    const accountId = accId;
    const verificationSelfieId = verSelfieId;
    const inquirySessionId = inqSessionId;
    const inqTemplateVersionId = inqTempVerId;
    const inqTemplateId = inqTempId;
    const verificationTemplateId = uuid();
    const verificationTemplateVersionId = uuid();
    const verTempAmvaId = uuid();
    const verAamvaId = uuid();

    // ── Check arrays (transformed by the requested mode) ──────────────────────
    const govIdChecks = applyMode([
        { name: "id_aamva_database_lookup",              status: "not_applicable", reasons: ["disabled_by_check_config"], requirement: "not_required", metadata: [] },
        { name: "id_account_comparison",                 status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_age_comparison",                     status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_age_inconsistency_detection",        status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_attribute_comparison",               status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_barcode_detection",                  status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_barcode_inconsistency_detection",    status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_blur_detection",                     status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_color_inconsistency_detection",      status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_compromised_detection",              status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_damaged_detection",                  status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_disallowed_country_detection",       status: "passed",         reasons: [],                           requirement: "required",     metadata: { country_code: null, selected_country_code: null } },
        { name: "id_disallowed_type_detection",          status: "passed",         reasons: [],                           requirement: "required",     metadata: { country_code: null, detected_id_class: null, detected_id_designations: null, disallowed_id_designations: null, selected_id_classes: null } },
        { name: "id_double_side_detection",              status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_electronic_replica_detection",       status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_entity_detection",                   status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_experimental_model_detection",       status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_expired_detection",                  status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_extracted_properties_detection",     status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_extraction_inconsistency_detection", status: "passed",         reasons: [],                           requirement: "not_required", metadata: { check_requirements: [] } },
        { name: "id_fabrication_detection",              status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_glare_detection",                    status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_handwriting_detection",              status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_inconsistent_repeat_detection",      status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_inquiry_comparison",                 status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_mrz_detection",                      status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_mrz_inconsistency_detection",        status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_number_format_inconsistency_detection", status: "passed",      reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_paper_detection",                    status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_physical_tamper_detection",          status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_po_box_detection",                   status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_portrait_clarity_detection",         status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_portrait_detection",                 status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_public_figure_detection",            status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_real_id_detection",                  status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_repeat_detection",                   status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_selfie_comparison",                  status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_tamper_detection",                   status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "id_unprocessable_submission_detection", status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_valid_dates_detection",              status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "id_video_quality_detection",            status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
    ], governmentIdChecks);

    const selfieChecksArray = applyMode([
        { name: "selfie_attribute_comparison",           status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_id_comparison",                  status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_pose_detection",                 status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_multiple_faces_detection",       status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_pose_repeat_detection",          status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_account_comparison",             status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_suspicious_entity_detection",    status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_liveness_detection",             status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_glasses_detection",              status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_glare_detection",                status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_experimental_model_detection",   status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_portrait_quality_detection",     status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_public_figure_detection",        status: "passed", reasons: [], requirement: "required",     metadata: [] },
        { name: "selfie_age_comparison",                 status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_face_covering_detection",        status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_video_quality_detection",        status: "passed", reasons: [], requirement: "not_required", metadata: [] },
        { name: "selfie_image_quality_detection",        status: "passed", reasons: [], requirement: "not_required", metadata: [] },
    ], selfieChecks);

    const databaseChecksArray = applyMode([
        { name: "database_inquiry_comparison",           status: "passed",         reasons: [],                           requirement: "not_required", metadata: [] },
        { name: "database_address_deliverable_detection", status: "not_applicable", reasons: ["disabled_by_check_config"], requirement: "not_required", metadata: [] },
        { name: "database_address_residential_detection", status: "not_applicable", reasons: ["disabled_by_check_config"], requirement: "not_required", metadata: [] },
        { name: "database_po_box_detection",             status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "database_deceased_detection",           status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
        { name: "database_identity_comparison",          status: "passed",         reasons: [],                           requirement: "required",     metadata: [] },
    ], databaseChecks);

    const aamvaChecksArray = applyMode([
        { name: "aamva_address_comparison",              status: "passed", reasons: [], requirement: "not_required", metadata: { match_result: null } },
        { name: "aamva_birthdate_comparison",            status: "passed", reasons: [], requirement: "required",     metadata: { match_result: null } },
        { name: "aamva_expiration_date_comparison",      status: "passed", reasons: [], requirement: "required",     metadata: { match_result: null } },
        { name: "aamva_identification_number_comparison", status: "passed", reasons: [], requirement: "required",    metadata: { match_result: null } },
        { name: "aamva_identity_comparison",             status: "passed", reasons: [], requirement: "required",     metadata: { match_result: null } },
        { name: "aamva_issue_date_comparison",           status: "passed", reasons: [], requirement: "required",     metadata: { match_result: null } },
        { name: "aamva_name_comparison",                 status: "passed", reasons: [], requirement: "required",     metadata: { match_result: null } },
    ], aamvaChecks);

    return {
        data: {
            type: "inquiry",
            id: inqId,
            attributes: {
                status: "approved",
                reference_id: null,
                note: null,
                behaviors: {
                    api_version_less_than_minimum_count: 0,
                    autofill_cancels: 34,
                    autofill_starts: 0,
                    behavior_threat_level: "medium",
                    bot_score: 1,
                    completion_time: 95.686319933,
                    debugger_attached: false,
                    devtools_open: false,
                    distraction_events: 5,
                    hesitation_baseline: 89972,
                    hesitation_count: 12,
                    hesitation_percentage: 77.63192993375718,
                    hesitation_time: 69847,
                    mobile_sdk_version_less_than_minimum_count: 0,
                    request_spoof_attempts: 0,
                    shortcut_copies: 0,
                    shortcut_pastes: 0,
                    user_agent_spoof_attempts: 0
                },
                tags: [],
                creator: "API",
                reviewer_comment: null,
                updated_at: subMinutes(5).toISOString(),
                created_at: subMinutes(10).toISOString(),
                started_at: subMinutes(9).toISOString(),
                expires_at: null,
                completed_at: subMinutes(6).toISOString(),
                failed_at: null,
                marked_for_review_at: null,
                decisioned_at: subMinutes(6).toISOString(),
                expired_at: null,
                redacted_at: null,
                previous_step_name: "database_bb6ded_collection_form",
                next_step_name: "success",
                name_first: firstName,
                name_middle: null,
                name_last: lastName,
                birthdate: dateBefore20Years.toISOString().split("T")[0],
                address_street_1: "600 CALIFORNIA STREET",
                address_street_2: null,
                address_city: "SAN FRANCISCO",
                address_subdivision: "California",
                address_subdivision_abbr: "CA",
                address_postal_code: "941090000",
                address_postal_code_abbr: "94109",
                identification_number: identificationNumber,
                fields: {
                    name_first: { type: "string", value: firstName },
                    name_middle: { type: "string", value: null },
                    name_last: { type: "string", value: lastName },
                    address_street_1: { type: "string", value: "600 CALIFORNIA STREET" },
                    address_street_2: { type: "string", value: null },
                    address_city: { type: "string", value: "SAN FRANCISCO" },
                    address_subdivision: { type: "string", value: "CA" },
                    address_postal_code: { type: "string", value: "94109" },
                    address_country_code: { type: "string", value: "US" },
                    birthdate: { type: "date", value: dateBefore20Years.toISOString().split("T")[0] },
                    identification_number: { type: "string", value: identificationNumber },
                    current_selfie: {
                        type: "selfie",
                        value: {
                            id: selfieProfileAndCenterId,
                            type: "Selfie::ProfileAndCenter"
                        }
                    },
                    address_number: { type: "string", value: "600" },
                    address_street: { type: "string", value: "CALIFORNIA STREET" },
                    social_security_number: { type: "string", value: "*******2626" }
                }
            },
            relationships: {
                account: { data: { type: "account", id: accId } },
                template: { data: null },
                inquiry_template: { data: { type: "inquiry-template", id: inqTempId } },
                inquiry_template_version: { data: { type: "inquiry-template-version", id: verTempId } },
                transaction: { data: null },
                reviewer: { data: { type: "workflow-run", id: werRunId } },
                reports: { data: [] },
                verifications: {
                    data: [
                        { type: "verification/government-id", id: verGovId },
                        { type: "verification/selfie", id: verSelfieId },
                        { type: "verification/database", id: verDbId }
                    ]
                },
                sessions: {
                    data: [{ type: "inquiry-session", id: inqSessionId }]
                },
                documents: {
                    data: [{ type: "document/government-id", id: documentGovernmentId }]
                },
                selfies: {
                    data: [{ type: "selfie/profile-and-center", id: selfieProfileAndCenterId }]
                }
            }
        },
        included: [
            {
                type: "verification/government-id",
                id: verGovId,
                attributes: {
                    status: "passed",
                    created_at: now.toISOString(),
                    created_at_ts: Math.floor(now.getTime() / 1000),
                    submitted_at: now.toISOString(),
                    submitted_at_ts: Math.floor(now.getTime() / 1000),
                    completed_at: now.toISOString(),
                    completed_at_ts: Math.floor(now.getTime() / 1000),
                    redacted_at: null,
                    country_code: "US",
                    tags: [],
                    entity_confidence_score: 100,
                    entity_confidence_reasons: ["generic"],
                    front_photo_url: "https://files.withpersona.com/photo1.jpg?dynamic_id=" + uuid(),
                    back_photo_url: null,
                    photo_urls: [{
                        page: "front",
                        url: "https://files.withpersona.com/photo1.jpg?dynamic_id=" + uuid(),
                        normalized_url: "https://files.withpersona.com/photo1.jpg?dynamic_id=" + uuid(),
                        original_urls: [
                            "https://files.withpersona.com/photo1.jpg?dynamic_id=" + uuid()
                        ],
                        byte_size: 92123
                    }],
                    selfie_photo: {
                        url: "https://files.withpersona.com/selfie_photo.jpg?dynamic_id=" + uuid(),
                        byte_size: 92123
                    },
                    selfie_photo_url: "https://files.withpersona.com/selfie_photo.jpg?dynamic_id=" + uuid(),
                    video_url: null,
                    id_class: "dl",
                    capture_method: "manual",
                    name_first: firstName,
                    name_middle: null,
                    name_last: lastName,
                    name_suffix: null,
                    native_name_first: null,
                    native_name_middle: null,
                    native_name_last: null,
                    native_name_title: null,
                    birthdate: dateBefore20Years.toISOString().split("T")[0],
                    address_street_1: "600 CALIFORNIA STREET",
                    address_street_2: null,
                    address_city: "SAN FRANCISCO",
                    address_subdivision: "CA",
                    address_postal_code: "94109",
                    issuing_authority: "CA",
                    issue_date: todayString(),
                    expiration_date: new Date(new Date().setFullYear(now.getFullYear() + 6)).toISOString().split("T")[0],
                    endorsements: null,
                    sex: "Male",
                    restrictions: null,
                    vehicle_class: null,
                    identification_number: identificationNumber,
                    from_reusable_persona: false,
                    checks: govIdChecks
                },
                relationships: {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    template: { data: null },
                    inquiry_template_version: { data: { type: "inquiry-template-version", id: verTempId } },
                    inquiry_template: { data: { type: "inquiry-template", id: inqTempId } },
                    verification_template: { data: { type: "verification-template/government-id", id: verGovId } },
                    verification_template_version: { data: { type: "verification-template-version/government-id", id: verTempVerId } },
                    transaction: { data: null },
                    document: { data: { type: "document/government-id", id: documentGovernmentId } },
                    accounts: { data: [{ type: "account", id: accountId }] }
                }
            },
            {
                type: "verification/selfie",
                id: verificationSelfieId,
                attributes: {
                    status: "passed",
                    created_at: now.toISOString(),
                    created_at_ts: Math.floor(now.getTime() / 1000),
                    submitted_at: now.toISOString(),
                    submitted_at_ts: Math.floor(now.getTime() / 1000),
                    completed_at: now.toISOString(),
                    completed_at_ts: Math.floor(now.getTime() / 1000),
                    redacted_at: null,
                    country_code: null,
                    tags: [],
                    left_photo_url: "https://files.withpersona.com/left_" + uuid() + ".jpg",
                    center_photo_url: "https://files.withpersona.com/center_" + uuid() + ".jpg",
                    right_photo_url: "https://files.withpersona.com/right_" + uuid() + ".jpg",
                    photo_urls: [
                        { page: "left_photo", url: "https://files.withpersona.com/left_" + uuid() + ".jpg", byte_size: 15619 },
                        { page: "center_photo", url: "https://files.withpersona.com/center_" + uuid() + ".jpg", byte_size: 15662 },
                        { page: "right_photo", url: "https://files.withpersona.com/right_" + uuid() + ".jpg", byte_size: 15716 }
                    ],
                    video_url: null,
                    center_photo_face_coordinates: null,
                    entity_confidence_reasons: [],
                    document_similarity_score: null,
                    selfie_similarity_score_left: null,
                    selfie_similarity_score_right: null,
                    from_reusable_persona: false,
                    checks: selfieChecksArray,
                    capture_method: "photo"
                },
                relationships: {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    template: { data: null },
                    inquiry_template_version: { data: { type: "inquiry-template-version", id: inqTempVerId } },
                    inquiry_template: { data: { type: "inquiry-template", id: inqId } },
                    verification_template: { data: { type: "verification-template/selfie", id: verSelfieId } },
                    verification_template_version: { data: { type: "verification-template-version/selfie", id: verTmpSelfieId } },
                    transaction: { data: null },
                    accounts: { data: [{ type: "account", id: accId }] }
                }
            },
            {
                type: "verification/database",
                id: verDbId,
                attributes: {
                    status: "passed",
                    created_at: now.toISOString(),
                    created_at_ts: Math.floor(now.getTime() / 1000),
                    submitted_at: now.toISOString(),
                    submitted_at_ts: Math.floor(now.getTime() / 1000),
                    completed_at: now.toISOString(),
                    completed_at_ts: Math.floor(now.getTime() / 1000),
                    redacted_at: null,
                    country_code: "US",
                    tags: [],
                    name_first: firstName,
                    name_middle: null,
                    name_last: lastName,
                    address_street_1: "600 CALIFORNIA STREET",
                    address_street_2: null,
                    address_city: "SAN FRANCISCO",
                    address_subdivision: "CA",
                    address_postal_code: "94109",
                    birthdate: dateBefore20Years.toISOString().split("T")[0],
                    identification_number: "*******2626",
                    document_number: null,
                    document_issuing_subdivision: null,
                    document_expiry_date: null,
                    document_issuing_date: null,
                    phone_number: null,
                    email_address: null,
                    normalized_address_street_1: null,
                    normalized_address_street_2: null,
                    normalized_address_city: null,
                    normalized_address_subdivision: null,
                    normalized_address_postal_code: null,
                    checks: databaseChecksArray
                },
                relationships: {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    template: { data: null },
                    inquiry_template_version: { data: { type: "inquiry-template-version", id: inqTemplateVersionId } },
                    inquiry_template: { data: { type: "inquiry-template", id: inqTemplateId } },
                    verification_template: { data: { type: "verification-template/database", id: verificationTemplateId } },
                    verification_template_version: { data: { type: "verification-template-version/database", id: verificationTemplateVersionId } },
                    transaction: { data: null },
                    accounts: { data: [{ type: "account", id: accountId }] }
                }
            },
            {
                type: "inquiry-session",
                id: inquirySessionId,
                attributes: {
                    status: "active",
                    created_at: now.toISOString(),
                    started_at: now.toISOString(),
                    expired_at: null,
                    ip_address: "186.86.110.232",
                    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
                    os_name: "Windows",
                    os_full_version: "10",
                    device_type: "desktop",
                    device_name: null,
                    browser_name: "Chrome",
                    browser_full_version: "144.0.0.0",
                    mobile_sdk_name: null,
                    mobile_sdk_full_version: null,
                    device_handoff_method: null,
                    is_proxy: false,
                    is_tor: false,
                    is_datacenter: false,
                    is_vpn: false,
                    threat_level: "low",
                    country_code: "US",
                    country_name: "United States",
                    region_code: "CA",
                    region_name: "California",
                    latitude: 37.751,
                    longitude: -97.822,
                    gps_latitude: 37.751,
                    gps_longitude: -97.822,
                    gps_precision: null,
                    ip_connection_type: "residential",
                    ip_isp: "Service Provider",
                    network_organization: "Digital Ocean"
                },
                relationships: {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    device: { data: { type: "device", id: deviceId } },
                    network: { data: { type: "network", id: netId } }
                }
            },
            {
                type: "document/government-id",
                id: documentGovernmentId,
                attributes: {
                    status: "processed",
                    created_at: now.toISOString(),
                    processed_at: now.toISOString(),
                    processed_at_ts: Math.floor(now.getTime() / 1000),
                    front_photo: {
                        filename: "photo1.jpg",
                        url: "https://files.withpersona.com/photo1.jpg?dynamic_id=" + uuid(),
                        byte_size: 92123
                    },
                    back_photo: null,
                    selfie_photo: {
                        filename: "selfie_photo.jpg",
                        url: "https://files.withpersona.com/selfie_photo.jpg?dynamic_id=" + uuid(),
                        byte_size: 92123
                    },
                    id_class: "dl",
                    name_first: firstName,
                    name_middle: null,
                    name_last: lastName,
                    name_suffix: null,
                    native_name_first: null,
                    native_name_middle: null,
                    native_name_last: null,
                    native_name_title: null,
                    birthdate: dateBefore20Years.toISOString().split("T")[0],
                    address_street_1: "600 CALIFORNIA STREET",
                    address_street_2: null,
                    address_city: "SAN FRANCISCO",
                    address_subdivision: "CA",
                    address_postal_code: "94109",
                    issuing_authority: "CA",
                    issue_date: todayString(),
                    expiration_date: new Date(new Date().setFullYear(now.getFullYear() + 6)).toISOString().split("T")[0],
                    designations: null,
                    sex: "Male",
                    endorsements: null,
                    restrictions: null,
                    vehicle_class: null,
                    identification_number: identificationNumber
                },
                relationships: {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    transaction: { data: null },
                    template: { data: null },
                    inquiry_template_version: { data: { type: "inquiry-template-version", id: verTempId } },
                    inquiry_template: { data: { type: "inquiry-template", id: inqTempId } },
                    document_files: { data: [] }
                }
            },
            {
                type: "inquiry-template",
                id: inqTempId,
                attributes: {
                    status: "active",
                    name: "(Universal Template) Government ID and Selfie with SSN",
                    embedded_flow_domain_allowlist: [],
                    hosted_flow_subdomains: [],
                    hosted_flow_redirect_uri_schemes: []
                },
                relationships: {
                    latest_published_version: { data: { type: "inquiry-template-version", id: verTempId } }
                }
            },
            ...(includeAamva ? [{
                "type": "verification/aamva",
                "id": verAamvaId,
                "attributes": {
                    status: "passed",
                    created_at: now.toISOString(),
                    created_at_ts: Math.floor(now.getTime() / 1000),
                    submitted_at: now.toISOString(),
                    submitted_at_ts: Math.floor(now.getTime() / 1000),
                    completed_at: now.toISOString(),
                    completed_at_ts: Math.floor(now.getTime() / 1000),
                    redacted_at: null,
                    country_code: null,
                    tags: [],
                    name_first: firstName,
                    name_last: lastName,
                    birthdate: dateBefore20Years.toISOString().split("T")[0],
                    issue_date: dateBefore3Years.toISOString().split("T")[0],
                    expiration_date: dateAfter2Years.toISOString().split("T")[0],
                    address_postal_code: "14014",
                    issuing_authority: "GA",
                    identification_number: "E12345567",
                    checks: aamvaChecksArray
                },
                "relationships": {
                    inquiry: { data: { type: "inquiry", id: inqId } },
                    template: { data: null },
                    inquiry_template_version: { data: { type: "inquiry-template-version", id: verTempId } },
                    inquiry_template: { data: { type: "inquiry-template", id: inqTempId } },
                    verification_template: { data: { type: "verification-template/aamva", id: verTempAmvaId } },
                    verification_template_version: { data: { type: "verification-template-version/aamva", id: verTempAmvaId } },
                    transaction: { data: null },
                    accounts: { data: [{ type: "account", id: accountId }] }
                }
            }] : [])
        ]
    }
}

export { getDates, personaConnectData, allChecksPersonaConnectData }