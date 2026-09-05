// CNETMOBİL V2
// Cihaz Talep toplu Excel şablonu ve .xlsx parser.
// Cihaz Talep modülü ile birlikte page.tsx dışına taşınmıştır.

export type CihazTalepBulkRow = {
  markaModel: string;
  hafiza: string;
  renk: string;
  pil: string;
  grade: string;
  garanti: string;
  degisenParca: string;
  kutuFatura: string;
  stokAdet: number;
};

const CIHAZ_TALEP_TEMPLATE_BASE64 = `UEsDBBQAAAAIAC16JV0C3QZg4AAAALQBAAAPAAAAeGwvd29ya2Jvb2sueG1stdGxTsMwEAbgV7FuJ07S4IaoboeyVGLiDZz40li1fZHPpRFPjyioRUwsbKd/+PXpv81uCV68YWJHUUNVlCAwDmRdPGo45/Ghhd12s3QXSqee6CSW4CN3i4Yp57mTkocJg+GCZoxL8COlYDIXlI6S54TG8oSYg5d1WSoZjIvw2XdN+XaJaAJq2LvJvHuTQFzTg9VQgUidsxpeS9U24+NQteteNbhu4NuS/mKhcXQDPtNwDhjzFyahN9lR5MnNDEL+1rw4zujxp6a+aWzZ1/bJVKuVVY1S5h808j6TvH9g+wFQSwMEFAAAAAgALXolXetQxADEAgAAkicAAA0AAAB4bC9zdHlsZXMueG1s5VpNb6MwEP0ryPctmI8kqkqrpBukvfTSPeyVEJNYGtvIOBXpr19hCKG7pZt0A9RKLsxM7DcP/DwWaO4eCgbWC5E5FTxE+MZBFuGJWFO+CdFOpd9m6OH+rrjN1R7I85YQZRUMeH5bhGirVHZr23myJSzOb0RGeMEgFZLFKr8RcmPnmSTxOi+nMbBdx5nYLKYclYip4Cq3ErHjKkSzJqSTvVovMYQIY2TZZYDHjFShx1gCVULH7eOMw3VVjW8AJjVAIkBIS25WIYrq3/9CO+9B46XvzPuB/hzrjzGdCE/deS90LwON34P2PB8HwbnQ9BToiT/1Z4vToGsj10koQCPmaSVmClBes1gpInlEAaza/rnPSIi44KRBrAf/c9JGxnvsBmfPywXQdcVr8/hGsY7reZWs7DfzL4S/jKJJ1CM+Djw/+N4ffjSLFn3yX7rLWeR8jF8bWmkrIddENlrz0TFYqfZvu7KUEqzO0g5/OKAxdeqEADyX58CvtMmPdf4itfiORUz9WIfIQVa5Lw4mBajNCqp2qkRtyEOKFnrwafgiPeY5HwC3AOIsg/3Tjq2IjPTRpv/W0UjwtkcBjt5Cg2n/VApu1z30TAFfCwXtz4FuOCNH8caHgLUVkr4KrsqSDyRVB5UWqYncX4hUNCn9hHBF5Gl306XHAbcEvhYKw+oRm65Hb6Ti5F4LhX70+FW5X1aPAxYn91ooDKtHbLoe/ZGKk3ctFM5Z03PW8Ouyv6wmByxQ3rVQGFqT2FBN+id8K+hZEF0U3PEpDFtpLruCrsHcByxHXRS88Slgg1fQM4t7YPCuDwze9YHBeg9M03tg8CnXxd01mDs2mLthejeuvndxN0zvxtX3Lu4m6L31fWEy0rvcZHwKXU8Bj/8UBqQwHeq9vu5WaDUq6MaFPzohmrhVdg+F6KnMB2/7Edp9D7l2j911978BUEsDBBQAAAAIAC16JV36XAFZAwMAANoNAAATAAAAeGwvdGhlbWUvdGhlbWUxLnhtbL1X23KbMBT8FUbvDTdz84RkEsduH9Jpp8kPyCBAjRAeSY6dv+8gbgKM4zR27AdLYs/ZReewwte3+5xor4hxXNAQmFcG0BCNihjTNARbkXzzwe3NNZyLDOVIozBHIVhkUHz//Qy0fU4on8MQZEJs5rrOowzlkF8VG0T3OUkKlkPBrwqW6jGDO0zTnOiWYbh6DjEFbd4lQTmigpcLEWFP0QGy8lr8YpY//I0vCNNeIQnBDtO42D2jvQAagVwsCAuBIT9A02+u9TaKiIlgJXAlP01gHRG/WDKQpes20lha/szsGCSCiDFw6ZffLqNEwChCtJajgk3HNXyrASuoangge+CZ9iBAYbDHDIF7b836ARJVDWfjG10FywenHyBR1dAZBdwZ1n1g9wMkqhq6o4DZ8s6zlv0AicoIpi9juOv5vtvAW0xSkB8H8YHrGt5Dg+9gutJqVQIqeo33K0lwhGTf5fBvwVYFFbLKUGCqibcNSmBUNigkeM2w9ojTTEgeOEfwHUDEjwL0AWeO6bsCjlAfIW3pOgZd3Qy5NbmYfCQTTMiTeCPokUtxvCA4XmFC5ERGtaXYZAvCGsIeMGWwG/M6Vcq1TcFDYIDJXNJBMBXVmus1Tz2ck23+s4jrpjdbO4BzDkV3wXAUn2gZ5CzlqoYSd7IOz57Q0dENddgn6pB3crIQ3/ywkOCoEF0pD8FUg+Up4cxqu+URJCguC1Yn6JX1LCUOZlN3ZH12a08oMc9gjJq8xpSSqWbruvAMRVakeP5hJUEwIaTcqksUWR/bAaH9mbYr+b3m7v7LLDaMiwfIswonL7XnK1VoAsP5Ahqr3JnL0ejDPURJgiIxsdJNH7mosxy8/Fl0OSm2ArGnLN5pa7Jlf2AcAsczHQNoMeaiKYAWY9a1z/j9oluHZJPB2sl7D22Fl+OWUxEr5Qyl9+e14nW6Ostx9X7UwLWm7NabfhIvcD4Gyrmk+Efgf9RTK6s897Gp6lDlTRqtPSHPvpDRdl35dYY6bNnSY5vXMTkb/IFqVm7+AVBLAwQUAAAACAAteiVdDR656GUAAABzAAAAFAAAAHhsL3NoYXJlZFN0cmluZ3MueG1sBcFRCsMgDADQq0j+Z9w+xpDankXatAomFpMNj7/3lm1ycz8aWrskePoAjmTvR5UrwdfOxwe2dZlR1dzkJhpngmJ2R0TdC3FW32+Sye3sg7Op7+NCvQflQwuRccNXCG/kXAUcrn9QSwMEFAAAAAgALXolXYNpec48IwAAKIYBABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWytnc1yXNd1hV+lg9LQEQmA/2XKJfKAZ++yFKscJal41hGbIkogwDSakpxRniKjVLkqE0/tuWeSX8RPkjrNc+6VfPf67pbLI5tYZy3sfAQHKwl6/fwX37652ny9299e3lw/PTn98O7JZnf9xc3Ly+svn568O7z6x0cnv/jo598++eZm/9Xt693usPn2zdX17ZNvn568PhzePrlz5/aL17s329sPb97urr99c/XqZv9me7j98Gb/5Z3bt/vd9uXR9ubqztnduw/uvNleXp+0wONXXxwff7bfvNy92r67Ovz65hvbXX75+vD05PT+yeZOe/jFzdVt/8/Nm8t25Mnmzfbb439+c/ny8Prpyfnpyeb15cuXu+unJ3dPNl+8uz3cvPm399rpHPPeftbtZ5P99N5PsJ93+/lsf/AT7Pe6/d5sv/sT7Pe7/f7f9t0fdPuDv+1/9ofd/nCyn53/BPujbn80f/eHP8H+uNsfz/azNfud+efn+ANXtodt+8P+5pvN/vio/aydPxjm6afv+DP6RXvz8enJ5vZI/PD05PawPypff/T8ny4+//RXz77/wyebv/z3/22ef/8H+/g3m88//uTis83nv/rsk3/Z/Pt3//vLTy4+vWhHfP3+lCn02RR6Z/ra8+BrJfjaRfC1F8HXavA1C77mP/zanSObHyBqiA9PT87uEaKzY8Lp+V8x+s3N/t311bvN9mp7fbXdP9l8ut1/td3c2Xx683J39bONbV99/8f/2v5s8+vd9Vebr3ebfz7cfLX5+OXusDlC3fzlf/60ufzz77b73eHqcnP73Z8O71rQy+3m6vL2sHu5u97c7r77/eWbzW+3b7//4/WHIev5uh/Ajr5Yoi9eRF98EX2xRl+06Iv+oy8umLd/VIfjv5O/Rv4+oz+7139679Jfzb3jdzo7/au/mh/9TYTUhLH/nbW/msj2XNja33D0voj3n12GV12I53W/fblTN71Qpu1+e324jCxVWMru+99d/vl3u+vNZ9v9d7/fRl4T3l++O7zbvNge3u0lPRfW6d/Fj0yLn5v7mX+r94/f4vzR9C1+8HP57L147ywSn5OzvBfPQvGiO+9F4gtyVhKNYj28doHsQQbZA0L2gJCRszwgZA8IGTkriUax/iCF7GEG2UNC9pCQkbM8JGQPCRk5K4lGsf4whexRBtkjQvaIkJGzPCJkjwgZOSuJRrH+KIXscQbZY0L2mJCRszwmZI8JGTkriUax/jiF7NgkVpm1VxpaVwU19JauCm7DG4NDb0XVMNnjm5fwTlPwThHeKcIjb+mqgneK8MhbUTVM9vjmJbxUS2ivAN4ZwiNv6aqCd4bwyFtRNUz2+OYlvPMUvHOEd47wyFu6quCdIzzyVlQNkz2+eQnvXgrePYR3D+GRt3RVwbuH8MhbUTVM9vjmJbxUYWivAB5WBvSWrip42BrQW1E1TPb45iW8VHVorwAelgf0lq4qeNgf0FtRNUz2+OYlvFSJaK8AHtYI9JauKnjYJNBbUTVM9vjmJbxUnWivAB4WCvSWrip42CnQW1E1TPb45iW8VLForwAeVgv0lq4qeNgu0FtRNUz2+Obl/zI41TDaKw2vqwIeektXBbzhjeGht6JqmOzxzUt4qYbRXgE8bBjoLV1V8LBhoLeiapjs8c1LeLn/OwQ2jK4qeNgwuqrgYcNAb0XVMNnjm5fwUg2jvQJ42DDQW7qq4GHDQG9F1TDZ45uX8FINo6kADxsGektXFTxsGOitqBome3zzEl6qYbRXAA8bBnpLVxU8bBjoragaJnt88xJeqmG0VwAPGwZ6S1cVPGwY6K2oGiZ7fPMSXqphtFcADxsGektXFTxsGOitqBome3zzEl6qYbRXAA8bBnpLVxU8bBjoragaJnt88xJeqmG0VwAPGwZ6S1cVPGwY6K2oGiZ7fPPy//Uh1TDaKw2vqwIeektXBbzhjeGht6JqmOzxzUt4qYbRXgE8bBjoLV1V8LBhoLeiapjs8c1LeKmG0V4BPGwY6C1dVfCwYaC3omqY7PHNS3iphtFeATxsGOgtXVXwsGGgt6JqmOzxzUt4qYbRXgE8bBjoLV1V8LBhoLeiapjs8c1LeKmG0V4BPGwY6C1dVfCwYaC3omqY7PHNS3iphtFeATxsGOgtXVXwsGGgt6JqmOzxzUt4qYbRXgE8bBjoLV1V8LBhoLeiapjs8c1LeKmG0V4BPGwY6C1dVfCwYaC3omqY7PHNS3iphtFeATxsGOgtXVXwsGGgt6JqmOzxzQt491INo73S8Loq4KG3dFXAG94YHnorqobJHt+8hJdqGO0VwMOGgd7SVQUPGwZ6K6qGyR7fvISXahjtFcDDhoHe0lUFDxsGeiuqhske37yEl2oY7RXAw4aB3tJVBQ8bBnorqobJHt+8hJdqGO0VwMOGgd7SVQUPGwZ6K6qGyR7fvISXahjtFcDDhoHe0lUFDxsGeiuqhske37yEl2oY7RXAw4aB3tJVBQ8bBnorqobJHt+8hJdqGO0VwMOGgd7SVQUPGwZ6K6qGyR7fvISXahjtFcDDhoHe0lUFDxsGeiuqhske37yEl2oY7RXAw4aB3tJVBQ8bBnorqobJHt+8/DW8VMNorzS8rqrfxMOG0VUBb3jFL+Nhw0DVMNnjm5fwUg2jvQJ42DDQW7qq4GHDQG9F1TDZ45uX8FINo70CeNgw0Fu6quBhw0BvRdUw2eObl/BSDaO9AnjYMNBbuqrgYcNAb0XVMNnjm5fwUg2jvQJ42DDQW7qq4GHDQG9F1TDZ45uX8HK/uM2/uc2/us2/u82/vM2/vc2/vs2/v82/wJ1rGPdTDaO9AnjYMNBbuqrgYcNAb0XVMNnjm5fwUg2jvQJ42DDQW7qq4GHDQG9F1TDZ45uX8FINo70CeNgw0Fu6quBhw0BvRdUw2eObl/BSDaO9AnjYMNBbuqrgYcNAb0XVMNnjm5efWpFqGO2VhtdV9cEV2DC6KuANr/jsCmwYqBome3zzEl6qYbRXAA8bBnpLVxU8bBjoragaJnt88xJeqmG0VwAPGwZ6S1cVPGwY6K2oGiZ7fPMSXqphtFcADxsGektXFTxsGOitqBome3zzEl6qYbRXAA8bBnpLVxU8bBjoragaJnt88xJeqmG0VwAPGwZ6S1cVPGwY6K2oGiZ7fPMSXu5DovhTovhjovhzoviDoviTovijovizovjDonIN40GqYbRXAA8bBnpLVxU8bBjoragaJnt88xJeqmG0VwAPGwZ6S1cVPGwY6K2oGiZ7fPMSXqphtFcADxsGektXFTxsGOitqBome3zz8kPeUg2jvdLwuqo+5w0bRlcFvOEVH/WGDQNVw2SPb17CSzWM9grgYcNAb+mqgocNA70VVcNkj29ewks1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb17CSzWM9grgYcNAb+mqgocNA70VVcNkj29ewks1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb17Cy30gLX8iLX8kLX8mLX8oLX8qLX8sLX8uLX8wba5hPEw1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb15+JnKqYbRXGl5X1cciY8PoqoA3vDE89FZUDZM9vnkJL9Uw2iuAhw0DvaWrCh42DPRWVA2TPb55CS/VMNorgIcNA72lqwoeNgz0VlQNkz2+eQkv1TDaK4CHDQO9pasKHjYM9FZUDZM9vnkJL9Uw2iuAhw0DvaWrCh42DPRWVA2TPb55CS/VMNorgIcNA72lqwoeNgz0VlQNkz2+eQkv1TDaK4CHDQO9pasKHjYM9FZUDZM9vnkJL9Uw2iuAhw0DvaWrCh42DPRWVA2TPb55CS83fsHrFzx/wfsXPIDBCxg8gcEbGDyCkWsYj1INo70CeNgw0Fu6quBhw0BvRdUw2eOblxMiqYbRXml4XVUrItgwuirgDW8MD70VVcNkj29ewks1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb17CSzWM9grgYcNAb+mqgocNA70VVcNkj29ewks1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb17CSzWM9grgYcNAb+mqgocNA70VVcNkj29ewks1jPYK4GHDQG/pqoKHDQO9FVXDZI9vXsJLNYz2CuBhw0Bv6aqChw0DvRVVw2SPb17Cyw3t8dIeT+3x1h6P7fHaHs/t8d4eD+5lF/eSk3srm3sro3srq3srs3sru3srw3sry3sr03vJ7b27ufG99oww8vweusuQJUZe4EN3Zdk43MXlAcbcDF97Rhh5iA/dZcgSI2/xobuybBzu4vIAY26Qrz0jjDzJh+4yZImRV/nQXVk2DndxeYAxN83XnhFGHudDdxmyxMj7fOiuLBuHu7g8wJgb6WvPCCPP9KG7DFli5KU+dFeWjcNdXB5gzM31tWeEkQf70F2GLDHyZh+6K8vG4S4uDzDmhvvaM8LI033oLkOWGHm9D92VZeNwF5cHGHMTfu0ZYeQRP3SXIUuMvOOH7sqycbiLywOMuTG/9oww8pwfusuQJUZe9EN3Zdk43MXlwfR1rsWsLIevTIevbIevjIevrIevzIev7IevDIinF8STE+IrG+IrI+IrK+IrM+IrO+IrQ+IrS+IrU+LJFpMcE19ZE1+ZE1/ZE18ZFF9ZFF+ZFF/ZFF8ZFc+uiidnxVd2xVeGxVeWxVemxVe2xVfGxVfWxVfmxbP74smB8ZWF8ZWJ8ZWN8ZWR8ZWV8ZWZ8ZWd8ZWh8ezSeHJqfGVrfGVsfGVtfGVufGVvfGVwfGVxfGVyPLs5nhwdX1kdX5kdX9kdXxkeX1keX5keX9keXxkfz66PJ+fHV/bHVwbIVxbIVybIVzbIV0bIV1bIV2bIszvkySHylSXylSnylS3ylTHylTXylTnylT3ylUHy7CJ5cpJ8ZZN8ZZR8ZZV8ZZZ8ZZd8ZZh8ZZl8ZZo8uU1+mhsnPz4DjDxPzu4yZIWRF8rZXVk2DndxeYAx12J4p3zIEiO3GJ4qn9wKI7cYXivncBeXBxhzLYYXy4csMXKL4dHyya0wcovh3XIOd3F5gDHXYni7fMgSI7cYni+f3AojtxheMOdwF5cHGHMthlfMhywxcovhIfPJrTByi+Etcw53cXmAMddieM98yBIjtxieNJ/cCiO3GF4153AXlwcYcy2Gl82HLDFyi+Fx88mtMHKL4X1zDndxeYAx12J443zIEiO3GJ45n9wKI7cYXjrncBeXBxhzLaY9I4zcYtBdhiwxcotBd2XZONzF5QHGXIvh3fMhS4zcYnj6fHIrjNxieP2cw11cvsSYG0A/PgOMPIHO7jJkhZFX0NldWTYOd3F5gDHXYngLfcgSI7cYnkOf3AojtxheROdwF5cHGHMthlfRhywxcovhYfTJrTByi+FtdA53cXmAMddieB99yBIjtxieSJ/cCiO3GF5J53AXlwcYcy2mPSOM3GLQXYYsMXKLQXdl2TjcxeUBxlyL4c30IUuM3GJ4Nn1yK4zcYng5ncNdXB5gzLUYXk8fssTILYYH1Ce3wsgthjfUOdzF5QHGXIvhHfUhS4zcYnhKfXIrjNxieE2dw11cHmDMtZj2jDByi0F3GbLEyC0G3ZVl43AXlwcYcy2Gt9WHLDFyi+F59cmtMHKL4YV1Dndx+RJjbmT9+Aww8sw6u8uQFUZeWmd3Zdk43MXlAcZci+G99SFLjNxieHJ9ciuM3GJ4dZ3DXVweYMy1GF5eH7LEyC2Gx9cnt8LILYb31zncxeUBxlyL4Q32IUuM3GJ4hn1yK4zcYniJncNdXB5gzLUYXmMfssTILYYH2Se3wsgthjfZOdzF5QHGXIvhXfYhS4zcYniafXIrjNxieJ2dw11cHmDMtRheaB+yxMgthkfaJ7fCyC2Gd9o53MXlAcZci+Gt9iFLjNxieK59ciuM3GJ4sZ3DXVweYMy1GF5tH7LEyC2Gh9snt8LILYa32zncxeUBxlyL4f32IUuM3GJ4wn1yK4zcYnjFncNdXL7EmBtyPz4DjDzlzu4yZIWR19zZXVk2DndxeYAx12J4033IEiO3GJ51n9wKI7cYXnbncBeXBxhzLYbX3YcsMXKL4YH3ya0wcovhjXcOd3F5gDHXYnjnfcgSI7cYnnqf3Aojtxhee+dwF5cHGHMthhffhywxcovh0ffJrTByi+Hddw53cXmAMddiePt9yBIjtxief5/cCiO3GF6A53AXlwcYcy2GV+CHLDFyi+Eh+MmtMHKL4S14DndxeYAx12J4D37IEiO3GJ6En9wKI7cYXoXncBeXBxhzLYaX4YcsMXKL4XH4ya0wcovhfXgOd3F5gDHXYngjfsgSI7cYnomf3AojtxheiudwF5cvMebG4o/PACPPxbO7DFlh5MV4dleWjcNdXB5gzLUY3o0fssTILYan4ye3wsgthtfjOdzF5QHGXIvhBfkhS4zcYnhEfnIrjNxieEeew11cHmDMtRjekh+yxMgthufkJ7fCyC2GF+U53MXlAcZci+FV+SFLjNxieFh+ciuM3GJ4W57DXVweYMy1GN6XH7LEyC2GJ+Ynt8LILYZX5jncxeUBxlyL4aX5IUuM3GJ4bH5yK4zcYnhvnsNdXB5gzLUY3pwfssTILYZn5ye3wsgthpfnOdzF5QHGXIvh9fkhS4zcYniAfnIrjNxieIOew11cHmDMtRjeoR+yxMgthqfoJ7fCyC2G1+g53MXlS4y5QfrjM8DIk/TsLkNWGHmVnt2VZeNwF5cHGHMthrfphywxcovhefrJrTByi+GFeg53cXmAMddieKV+yBIjtxgeqp/cCiO3GN6q53AXlwcYcy2G9+qHLDFyi+HJ+smtMHKL4dV6DndxeYAx12J4uX7IEiO3GB6vn9wKI7cY3q/ncBeXBxhzLYY37IcsMXKL4Rn7ya0wcovhJXsOd3F5gDHXYnjNfsgSI7cYHrSf3AojtxjetOdwF5cHGHMthnfthywxcovhafvJrTByi+F1ew53cXmAMddieOF+yBIjtxgeuZ/cCiO3GN6553AXlwcYcy2Gt+6HLDFyi+G5+8mtMHKL4cV7Dndx+RJjbvT++Aww8uw9u8uQFUbcp3/B7sqycbiLywOMuRaDG/bPhiwxcovBofqLya0wcotB2TjcxeUBxlyLwTX7Z0OWGLnF4GT9xeRWGLnFoGwc7uLyAGOuxeCu/bMhS4zcYnC8/mJyK4zcYlA2DndxeYAx12Jw4f7ZkCVGbjE4Y38xuRVGbjEoG4e7uDzAmGsxuHX/bMgSI7cYHLS/mNwKI7cYlI3DXVweYMy1GFy9fzZkiZFbDE7bX0xuhZFbDMrG4S4uDzDmWky8JT9j5BaD7jJkiZFbDLory8bhLi4PMOZaTLwqP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvC8/Y+QWg+4yZImRWwy6K8vG4S4uX2JsE/IJjPHS/ISxywojusuQFcbhFhjRXVk2DndxeYAx12LizfkZI7cYdJchS4zcYtBdWTYOd3F5gDHXYuL1+Rkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4h36GSO3GHSXIUuM3GLQXVk2DndxeYAx12LiRfoZI7cYdJchS4zcYtBdWTYOd3F5gDHXYuJt+hkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4pX6GSO3GHSXIUuM3GLQXVk2DndxeYAx12LivfoZI7cYdJchS4zcYtBdWTYOd3F5gDHXYuLl+hkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4g37GSO3GHSXIUuM3GLQXVk2Dndx+QLjWRunX8d4fKYxDllgZHcZssA4uWOM7K4sG4e7uDzAmGoxx2eEEVsMu8uQJUZsMeyuLBuHu7g8wJhqMcdnhBFbDLvLkCVGbDHsriwbh7u4PMCYajHHZ4QRWwy7y5AlRmwx7K4sG4e7uDzAmGoxx2eEEVsMu8uQJUZsMeyuLBuHu7g8wJhqMcdnhBFbDLvLkCVGbDHsriwbh7u4PMCYajHHZ4QRWwy7y5AlRmwx7K4sG4e7uDzAmGoxx2eEEVsMu8uQJUZsMeyuLBuHu7g8wJhqMcdnhBFbDLvLkCVGbDHsriwbh7u4PMCYajHHZ4QRWwy7y5AlRmwx7K4sG4e7uHyJsY3TJzDGG/YTxi4rjOguQ1YYh1tgRHdl2TjcxeUBxlyLiTfsZ4zcYtBdhiwxcotBd2XZONzF5QHGXIuJN+xnjNxi0F2GLDFyi0F3Zdk43MXlAcZci4k37GeM3GLQXYYsMXKLQXdl2TjcxeUBxlyLiTfsZ4zcYtBdhiwxcotBd2XZONzF5QHGXIuJN+xnjNxi0F2GLDFyi0F3Zdk43MXlAcZci4k37GeM3GLQXYYsMXKLQXdl2TjcxeUBxlyLiTfsZ4zcYtBdhiwxcotBd2XZONzF5QHGXIuJN+xnjNxi0F2GLDFyi0F3Zdk43MXlAcZci4k37GeM3GLQXYYsMXKLQXdl2TjcxeVLjG2cPoEx3rCfMHZZYUR3GbLCONwCI7ory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvGE/Y+QWg+4yZImRWwy6K8vG4S4uDzDmWky8YT9j5BaD7jJkiZFbDLory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvGE/Y+QWg+4yZImRWwy6K8vG4S4uDzDmWky8YT9j5BaD7jJkiZFbDLory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMe0YYucWguwxZYuQWg+7KsnG4i8sDjLkWE2/Yzxi5xaC7DFli5BaD7sqycbiLy5cY2zh9AmO8YT9h7LLCiO4yZIVxuAVGdFeWjcNdXB5gzLWYeMN+xsgtBt1lyBIjtxh0V5aNw11cHmDMtZh4w37GyC0G3WXIEiO3GHRXlo3DXVweYMy1mHjDfsbILQbdZcgSI7cYdFeWjcNdXB5gzLWY9owwcotBdxmyxMgtBt2VZeNwF5cHGHMtJt6wnzFyi0F3GbLEyC0G3ZVl43AXlwcYcy0m3rCfMXKLQXcZssTILQbdlWXjcBeXBxhzLSbesJ8xcotBdxmyxMgtBt2VZeNwF5cHGHMtpj0jjNxi0F2GLDFyi0F3Zdk43MXlAcZci4k37GeM3GLQXYYsMXKLQXdl2TjcxeVLjG2cPoEx3rCfMHZZYUR3GbLCONwCI7ory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvGE/Y+QWg+4yZImRWwy6K8vG4S4uDzDmWky8YT9j5BaD7jJkiZFbDLory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvGE/Y+QWg+4yZImRWwy6K8vG4S4uDzDmWky8YT9j5BaD7jJkiZFbDLory8bhLi4PMOZaTLxhP2PkFoPuMmSJkVsMuivLxuEuLg8w5lpMvGE/Y+QWg+4yZImRWwy6K8vG4S4uDzDmWky8YT9j5BaD7jJkiZFbDLory8bhLi5fYmzj9AmM8Yb9hLHLCiO6y5AVxuEWGNFdWTYOd3F5gDHXYuIN+xkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4g37GSO3GHSXIUuM3GLQXVk2DndxeYAx12LiDfsZI7cYdJchS4zcYtBdWTYOd3F5gDHXYuIN+xkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4g37GSO3GHSXIUuM3GLQXVk2DndxeYAx12LiDfsZI7cYdJchS4zcYtBdWTYOd3F5gDHXYuIN+xkjtxh0lyFLjNxi0F1ZNg53cXmAMddi4g37GSO3GHSXIUuM3GLQXVk2DndxeYAx12LiDfsZI7cYdJchS4zcYtBdWTYOd3H5EmMbp09gjDfsJ4xdVhjRXYasMA63wIjuyrJxuIvLA4y5FhNv2M8YucWguwxZYuQWg+7KsnG4i8sDjLkWE2/Yzxi5xaC7DFli5BaD7sqycbiLywOMuRYTb9jPGLnFoLsMWWLkFoPuyrJxuIvLA4y5FhNv2M8YucWguwxZYuQWg+7KsnG4i8sDjLkWE2/Yzxi5xaC7DFli5BaD7sqycbiLywOMuRYTb9jPGLnFoLsMWWLkFoPuyrJxuIvLA4y5FhNv2M8YucWguwxZYuQWg+7KsnG4i8sDjLkWE2/Yzxi5xaC7DFli5BaD7sqycbiLywOMuRYTb9jPGLnFoLsMWWLkFoPuyrJxuIvLlxjbOH0CY7xhP2HsssKI7jJkhXG4BUZ0V5aNw11cHmDMtZh4w37GyC0G3WXIEiO3GHRXlo3DXVweYMy1mHjDfsbILQbdZcgSI7cYdFeWjcNdXB5gzLWYeMN+xsgtBt1lyBIjtxh0V5aNw11cHmDMtZh4w37GyC0G3WXIEiO3GHRXlo3DXVweYMy1mHjDfsbILQbdZcgSI7cYdFeWjcNdXB5gzLWYeMN+xsgtBt1lyBIjtxh0V5aNw11cHmDMtZh4w37GyC0G3WXIEiO3GHRXlo3DXVweYMy1mHjDfsbILQbdZcgSI7cYdFeWjcNdXB5gzLWYeMN+xsgtBt1lyBIjtxh0V5aNw11cvsTYxukTGOMN+wljlxVGdJchK4zDLTCiu7JsHO7i8gBjrsXEG/YzRm4x6C5Dlhi5xaC7smwc7uLyAGOuxcQb9jNGbjHoLkOWGLnFoLuybBzu4vIAY67FxBv2M0ZuMeguQ5YYucWgu7JsHO7i8gBjrsXEG/YzRm4x6C5Dlhi5xaC7smwc7uLyAGOuxcQb9jNGbjHoLkOWGLnFoLuybBzu4vIAY67FxBv2M0ZuMeguQ5YYucWgu7JsHO7i8gBjrsXEG/YzRm4x6C5Dlhi5xaC7smwc7uLyAGOuxcQb9jNGbjHoLkOWGLnFoLuybBzu4vIAY67FxBv2M0ZuMeguQ5YYucWgu7JsHO7i8iXGNk6fwBhv2E8Yu6wworsMWWEcboER3ZVl43AXlwcYcy0m3rCfMXKLQXcZssTILQbdlWXjcBeXBxhzLSbesJ8xcotBdxmyxMgtBt2VZeNwF5cHGHMtJt6wnzFyi0F3GbLEyC0G3ZVl43AXlwcYcy0m3rCfMXKLQXcZssTILQbdlWXjcBeXBxhzLSbesJ8xcotBdxmyxMgtBt2VZeNwF5cHGHMtJt6wnzFyi0F3GbLEyC0G3ZVl43AXlwcYcy0m3rCfMXKLQXcZssTILQbdlWXjcBeXBxhzLSbesJ8xcotBdxmyxMgtBt2VZeNwF5cHGHMtJt6wnzFyi0F3GbLEyC0G3ZVl43AXly8wnrdx+nWMx2ca45AFRnaXIQuMkzvGyO7KsnG4i8sDjKkWc3xGGLHFsLsMWWLEFsPuyrJxuIvLA4ypFnN8RhixxbC7DFlixBbD7sqycbiLywOMqRZzfEYYscWwuwxZYsQWw+7KsnG4i8sDjKkWc3zW4h4LjL3FnAuM5C5Dbh+cH2Ls7vsCI7kry8bhLi4fGO98++T29W53KNvDtpne7PZf7p7vrq5uf/SnzX736unJx6dP/LSn/7V09sTPRvKPQ15uD9t/3V5dvtweLm+ubzdf3Ly7Pjw9uX+yFDeH377dPT25urw9nGxu//OY/Oz+k+PfTnv96mb/5t3V9vSjTy5vD7ur3f4fPvj4g7MnH3z8waP2fSe5/eHHybnvdXH/yQV8r2ftez374P7f5XvZ/ScG3+t5+17PPzj/u3yvF/efvIDvVdr3Kn/L/1w3b3f77eFm//Tky/1ue9jtP3+9vf7V/uI/322vpu/u958cfwx/9N1PV7/Z4kvHn6a32y93n273X15e326udq8OT0/ufvjwZLN//y/++N8PN2+P/+3+yeY/bg6HmzfjT69325e7ffvT+cnm1c3NYfrD+5/bb272Xx3/NXz0/1BLAwQUAAAACAAteiVdS6IwPy8CAAAOBwAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbJ2V3W7aMBiGb+WTz5f/BFQ1VDCgnQAxVWwThx5xiLUkRrYDdDfQm5jUw56WayC7rymB0sxKQOIodvI+/h69guT2bpvEsCZcUJb6yNQMBCRdsICmSx9lMvzURned2+3NhvFfIiJEwjaJU3Gz9VEk5epG18UiIgkWGluRdJvEIeMJlkJjfKmLFSc4KLEk1i3D8PQE0xQVB5Z3h2X4K4eAhDiL5SPbPBC6jKSPTBeBXgQXLBbHKyS0kESQ4G153dBARj4y2wgiGgQk9ZGBYJEJyZIfx2cfxxxw64hb1+H2Ebevw50j7lyHe0fcO+HORVz/6LAsvY8lLjacbYAXoXJCseyaCISPnBYC6SMheflo3XnAYb77jYuT1ofzTkivAbnnOCB1wOcGYJTJDIZYZrx2Tr9pDuY4lbQOGR4Q11CQXgYCP4UY8P4138X5jkNMhSQx4UD3rzQNKNegT/IX+vdFUp6QJ5pq/03Qy/YqJVqVEi1lnm3d92qrU4OT/Z/RYDIZjGt7U9Pfu4+1Ram5+XR03t2uuNsK7DkN7mpw/zwdQf42z99q5e0LUu/yas6G7vy8vVOxdxTatNoN+mqy0byvJr2LRm7FyFVoy/UajNTk9NtsPJjVKqlRE+ZfxuedvIqTp+Cuqf5AdRVvVXD1H2jOLsDtCtxW+2iAdeVdtcJLMsF8SVMBMQmljwythYAfvhXlWrJVuXIR/GRSsuR9FxEcEF7sbAQhY/K0ObwcT5+2zj9QSwMEFAAAAAAALXolXREhsVwoAQAAKAEAAAsAAABfcmVscy8ucmVsc++7vzw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9InV0Zi04Ij8+PFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL29mZmljZURvY3VtZW50IiBUYXJnZXQ9Ii94bC93b3JrYm9vay54bWwiIElkPSJSNTNkNDYzMTUzYWU3NDcyZSIgLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAIAC16JV0q1QxGJAEAAJEDAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHPN0z9OwzAUBvCrWN6JE8exE9S0Cwtr6QUc++WPGtuR7UJ6NgaOxBUQBaEEMbBU6vKG70mffn6S31/fNrvZjOgZfBicrXGWpBiBVU4PtqvxKbZ3Jd5tN3sYZRycDf0wBTSb0YYa9zFO94QE1YORIXET2NmMrfNGxpA435FJqqPsgNA05cQvO/C6Ex3OE/yn0bXtoODBqZMBG/8oJiGeRwgYHaTvINaYzON3lsxmxOhR13hfsbyiTVGITJRM5hojcjVQ7MHA2nOJvma2UEHFS1VRDlSkjIvqmqrQSw/6KfrBdr+vtVwteILqQlFZQtsCY1VzTd6L88fQA8Q17Sf+fABAXF4v5SVrC5WVouEMBLsBHl3wdNpQXckszzVnnMsLj6w+1vYDUEsDBBQAAAAIAC16JV2hO89OGwEAANwDAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLWTQU7DMBBFrxJ5i2K3XSCEknYBbAEJLmA5k8SqPbY8k5KejQVH4gqoLqoAIUVV241nM37v/8V8vn9Uq9G7YgOJbMBazOVMFIAmNBa7WgzcljditaxetxGoGL1DqkXPHG+VItOD1yRDBBy9a0PymkmG1KmozVp3oBaz2bUyARmQS94xxLK6h1YPjouHkQH32tE7Udzt93aqWugYnTWabUC1weaPpAxtaw00wQwekCXFBLqhHoC9k3lKry1eZbD615nA0XHS71Yygcs71NtIB8XTBlKyDRTPOvGj9lALNTpFvHVA8swNM3RKzT142L/zkwNkzGTZXidoXjhZ7M7e+Sd7KshbSOv8kVQep/f/HebAPzbI4uJBVL7V5RdQSwECFAMUAAAACAAteiVdAt0GYOAAAAC0AQAADwAAAAAAAAAAAAAApIEAAAAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgALXolXetQxADEAgAAkicAAA0AAAAAAAAAAAAAAKSBDQEAAHhsL3N0eWxlcy54bWxQSwECFAMUAAAACAAteiVd+lwBWQMDAADaDQAAEwAAAAAAAAAAAAAApIH8AwAAeGwvdGhlbWUvdGhlbWUxLnhtbFBLAQIUAxQAAAAIAC16JV0NHrnoZQAAAHMAAAAUAAAAAAAAAAAAAACkgTAHAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQIUAxQAAAAIAC16JV2DaXnOPCMAACiGAQAYAAAAAAAAAAAAAACkgccHAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECFAMUAAAACAAteiVdS6IwPy8CAAAOBwAAGAAAAAAAAAAAAAAApIE5KwAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sUEsBAhQDFAAAAAAALXolXREhsVwoAQAAKAEAAAsAAAAAAAAAAAAAAKSBni0AAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgALXolXSrVDEYkAQAAkQMAABoAAAAAAAAAAAAAAKSB7y4AAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgALXolXaE7z04bAQAA3AMAABMAAAAAAAAAAAAAAKSBSzAAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAkACQBJAgAAlzEAAAAA`;

export function downloadCihazTalepTemplate() {
  const binary = atob(CIHAZ_TALEP_TEMPLATE_BASE64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cihaz_talep_toplu_sablon.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BULK_CIHAZ_HEADERS = [
  'MARKA MODEL',
  'HAFIZA',
  'RENK',
  'PIL',
  'GRADE',
  'GARANTI',
  'DEGISEN PARCA',
  'KUTU FATURA',
  'STOK ADET',
] as const;

function normalizeBulkHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/▼/g, '')
    .replace(/[\/_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xlsxColumnIndex(cellRef: string) {
  const letters = String(cellRef || '').match(/^[A-Z]+/i)?.[0] || 'A';
  let result = 0;

  for (const char of letters.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }

  return Math.max(0, result - 1);
}

async function inflateXlsxDeflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Tarayıcınız Excel dosyasını açmayı desteklemiyor. Güncel Chrome veya Edge kullanın.'
    );
  }

  // TypeScript / Next.js BlobPart uyumluluğu:
  // Uint8Array buffer'ı SharedArrayBuffer olabileceği için
  // veriyi kesin ArrayBuffer içine kopyalıyoruz.
  const safeBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(safeBuffer).set(data);

  const stream = new Blob([safeBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}

async function unzipSimpleXlsx(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let eocd = -1;
  const minOffset = Math.max(0, bytes.length - 65557);

  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (
      view.getUint32(i, true) === 0x06054b50
    ) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error('Geçerli bir .xlsx dosyası değil.');
  }

  const totalEntries =
    view.getUint16(eocd + 10, true);

  let centralOffset =
    view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder('utf-8');
  const files = new Map<string, Uint8Array>();

  for (let entry = 0; entry < totalEntries; entry++) {
    if (
      view.getUint32(centralOffset, true) !==
      0x02014b50
    ) {
      throw new Error('Excel ZIP yapısı okunamadı.');
    }

    const method =
      view.getUint16(centralOffset + 10, true);

    const compressedSize =
      view.getUint32(centralOffset + 20, true);

    const fileNameLength =
      view.getUint16(centralOffset + 28, true);

    const extraLength =
      view.getUint16(centralOffset + 30, true);

    const commentLength =
      view.getUint16(centralOffset + 32, true);

    const localOffset =
      view.getUint32(centralOffset + 42, true);

    const fileName = decoder.decode(
      bytes.slice(
        centralOffset + 46,
        centralOffset + 46 + fileNameLength
      )
    );

    if (
      view.getUint32(localOffset, true) !==
      0x04034b50
    ) {
      throw new Error('Excel dosya başlığı okunamadı.');
    }

    const localNameLength =
      view.getUint16(localOffset + 26, true);

    const localExtraLength =
      view.getUint16(localOffset + 28, true);

    const dataStart =
      localOffset +
      30 +
      localNameLength +
      localExtraLength;

    const compressed = bytes.slice(
      dataStart,
      dataStart + compressedSize
    );

    let content: Uint8Array;

    if (method === 0) {
      content = compressed;
    } else if (method === 8) {
      content =
        await inflateXlsxDeflateRaw(compressed);
    } else {
      throw new Error(
        `Desteklenmeyen Excel sıkıştırma tipi: ${method}`
      );
    }

    files.set(fileName, content);

    centralOffset +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;
  }

  return files;
}

function readXlsxSharedStrings(
  files: Map<string, Uint8Array>
) {
  const bytes =
    files.get('xl/sharedStrings.xml');

  if (!bytes) return [] as string[];

  const xml = new TextDecoder('utf-8').decode(bytes);
  const doc = new DOMParser().parseFromString(
    xml,
    'application/xml'
  );

  return Array.from(
    doc.getElementsByTagNameNS('*', 'si')
  ).map((item) =>
    Array.from(
      item.getElementsByTagNameNS('*', 't')
    )
      .map((node) => node.textContent || '')
      .join('')
  );
}

function parseXlsxWorksheet(
  sheetBytes: Uint8Array,
  sharedStrings: string[]
) {
  const xml =
    new TextDecoder('utf-8').decode(sheetBytes);

  const doc =
    new DOMParser().parseFromString(
      xml,
      'application/xml'
    );

  if (
    doc.getElementsByTagName('parsererror').length
  ) {
    throw new Error(
      'Excel çalışma sayfası okunamadı.'
    );
  }

  const parsedRows: string[][] = [];

  const xmlRows = Array.from(
    doc.getElementsByTagNameNS('*', 'row')
  );

  for (const xmlRow of xmlRows) {
    const rowNumber =
      Math.max(
        1,
        Number(xmlRow.getAttribute('r')) || 1
      );

    while (parsedRows.length < rowNumber) {
      parsedRows.push([]);
    }

    const output =
      parsedRows[rowNumber - 1];

    const cells = Array.from(
      xmlRow.getElementsByTagNameNS('*', 'c')
    );

    for (const cell of cells) {
      const cellRef =
        cell.getAttribute('r') || 'A1';

      const colIndex =
        xlsxColumnIndex(cellRef);

      const type =
        cell.getAttribute('t') || '';

      const valueNode =
        cell.getElementsByTagNameNS('*', 'v')[0];

      let value = '';

      if (type === 'inlineStr') {
        value = Array.from(
          cell.getElementsByTagNameNS('*', 't')
        )
          .map((node) => node.textContent || '')
          .join('');
      } else {
        const raw =
          valueNode?.textContent || '';

        if (type === 's') {
          value =
            sharedStrings[
              Number(raw)
            ] ?? '';
        } else {
          value = raw;
        }
      }

      output[colIndex] =
        String(value ?? '').trim();
    }
  }

  return parsedRows;
}

export async function parseCihazTalepBulkXlsx(
  file: File
): Promise<CihazTalepBulkRow[]> {
  if (
    !file.name
      .toLocaleLowerCase('tr-TR')
      .endsWith('.xlsx')
  ) {
    throw new Error(
      'Sadece .xlsx Excel dosyası yükleyebilirsiniz.'
    );
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error(
      'Excel dosyası en fazla 8 MB olabilir.'
    );
  }

  const files =
    await unzipSimpleXlsx(
      await file.arrayBuffer()
    );

  const worksheetPaths =
    Array.from(files.keys())
      .filter((name) =>
        /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
      )
      .sort((a, b) => {
        const aNo =
          Number(a.match(/sheet(\d+)/i)?.[1] || 0);
        const bNo =
          Number(b.match(/sheet(\d+)/i)?.[1] || 0);

        return aNo - bNo;
      });

  if (!worksheetPaths.length) {
    throw new Error(
      'Excel dosyasında çalışma sayfası bulunamadı.'
    );
  }

  const sharedStrings =
    readXlsxSharedStrings(files);

  let rows: string[][] = [];
  let headerIndexes =
    new Map<string, number>();
  let foundTemplateSheet = false;

  // Excel bazen sayfa XML sırasını değiştirebilir.
  // Bu yüzden sheet1 varsaymak yerine, başlıkları gerçekten
  // "Marka / Model, Hafıza, Renk..." olan sayfayı buluyoruz.
  for (const worksheetPath of worksheetPaths) {
    const candidateRows =
      parseXlsxWorksheet(
        files.get(worksheetPath)!,
        sharedStrings
      );

    if (!candidateRows.length) {
      continue;
    }

    // Başlık satırını ilk 10 satır içinde ara.
    // Böylece Excel dosyası farklı bir programda kaydedilse bile
    // şablon daha dayanıklı olur.
    for (
      let headerRowIndex = 0;
      headerRowIndex < Math.min(candidateRows.length, 10);
      headerRowIndex++
    ) {
      const candidateHeader =
        (candidateRows[headerRowIndex] || [])
          .map(normalizeBulkHeader);

      const candidateIndexes =
        new Map<string, number>();

      candidateHeader.forEach(
        (header, index) => {
          candidateIndexes.set(
            header,
            index
          );
        }
      );

      const hasAllHeaders =
        BULK_CIHAZ_HEADERS.every(
          (header) =>
            candidateIndexes.has(header)
        );

      if (hasAllHeaders) {
        rows =
          candidateRows.slice(
            headerRowIndex
          );

        headerIndexes =
          candidateIndexes;

        foundTemplateSheet = true;
        break;
      }
    }

    if (foundTemplateSheet) {
      break;
    }
  }

  if (!foundTemplateSheet) {
    throw new Error(
      'Cihazlar sayfası bulunamadı. Lütfen panelden indirdiğiniz Excel şablonunu kullanın ve başlıkları değiştirmeyin.'
    );
  }

  const getValue = (
    row: string[],
    header: typeof BULK_CIHAZ_HEADERS[number]
  ) => {
    const index =
      headerIndexes.get(header);

    return String(
      index === undefined
        ? ''
        : row[index] ?? ''
    ).trim();
  };

  const devices: CihazTalepBulkRow[] = [];
  const errors: string[] = [];

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex] || [];

    const allEmpty =
      BULK_CIHAZ_HEADERS.every(
        (header) =>
          getValue(row, header) === ''
      );

    if (allEmpty) continue;

    const markaModel =
      getValue(row, 'MARKA MODEL');

    const hafiza =
      getValue(row, 'HAFIZA');

    const renk =
      getValue(row, 'RENK');

    const pil =
      getValue(row, 'PIL');

    const grade =
      getValue(row, 'GRADE')
        .toLocaleUpperCase('tr-TR');

    const garanti =
      getValue(row, 'GARANTI');

    const degisenParca =
      getValue(row, 'DEGISEN PARCA') ||
      'Orijinal / Yok';

    const kutuFatura =
      getValue(row, 'KUTU FATURA');

    const stokRaw =
      getValue(row, 'STOK ADET');

    const stokAdet =
      Number(stokRaw);

    const excelLine = rowIndex + 1;

    if (!markaModel) {
      errors.push(
        `${excelLine}. satır: Marka / Model boş.`
      );
    }

    if (!hafiza) {
      errors.push(
        `${excelLine}. satır: Hafıza boş.`
      );
    }

    if (!renk) {
      errors.push(
        `${excelLine}. satır: Renk boş.`
      );
    }

    if (
      !Number.isInteger(stokAdet) ||
      stokAdet < 1
    ) {
      errors.push(
        `${excelLine}. satır: Stok Adet 1 veya daha büyük tam sayı olmalı.`
      );
    }

    if (
      grade &&
      ![
        'MÜKEMMEL',
        'ÇOK İYİ',
        'İYİ',
        'OUTLET',
      ].includes(grade)
    ) {
      errors.push(
        `${excelLine}. satır: Grade geçersiz.`
      );
    }

    devices.push({
      markaModel,
      hafiza,
      renk,
      pil,
      grade,
      garanti,
      degisenParca,
      kutuFatura,
      stokAdet,
    });
  }

  if (errors.length) {
    throw new Error(
      errors.slice(0, 8).join('\n') +
        (errors.length > 8
          ? `\n+${errors.length - 8} hata daha`
          : '')
    );
  }

  if (!devices.length) {
    throw new Error(
      'Yüklenecek cihaz bulunamadı. Excel içinde “Cihazlar” sayfasında, başlık satırının altına en az 1 cihaz girin.'
    );
  }

  if (devices.length > 500) {
    throw new Error(
      'Tek seferde en fazla 500 cihaz yükleyebilirsiniz.'
    );
  }

  return devices;
}
